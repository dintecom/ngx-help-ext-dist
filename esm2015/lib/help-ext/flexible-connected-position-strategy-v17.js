/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
import { coerceArray, coerceCssPixelValue } from '@angular/cdk/coercion';
import { ConnectedOverlayPositionChange, validateHorizontalPosition, validateVerticalPosition, } from '@angular/cdk/overlay';
import { ElementRef } from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { isElementClippedByScrolling, isElementScrolledOutsideView } from './scroll-clip-v17';
// TODO: refactor clipping detection into a separate thing (part of scrolling module)
// TODO: doesn't handle both flexible width and height when it has to scroll along both axis.
/** Class to be added to the overlay bounding box. */
const boundingBoxClass = 'cdk-overlay-connected-position-bounding-box';
/** Regex used to split a string on its CSS units. */
const cssUnitPattern = /([A-Za-z%]+)$/;
/**
 * A strategy for positioning overlays. Using this strategy, an overlay is given an
 * implicit position relative some origin element. The relative position is defined in terms of
 * a point on the origin element that is connected to a point on the overlay element. For example,
 * a basic dropdown is connecting the bottom-left corner of the origin to the top-left corner
 * of the overlay.
 */
export class FlexibleConnectedPositionStrategy17 {
    constructor(connectedTo, _viewportRuler, _document, _platform, _overlayContainer) {
        this._viewportRuler = _viewportRuler;
        this._document = _document;
        this._platform = _platform;
        this._overlayContainer = _overlayContainer;
        /** Last size used for the bounding box. Used to avoid resizing the overlay after open. */
        this._lastBoundingBoxSize = { width: 0, height: 0 };
        /** Whether the overlay was pushed in a previous positioning. */
        this._isPushed = false;
        /** Whether the overlay can be pushed on-screen on the initial open. */
        this._canPush = true;
        /** Whether the overlay can grow via flexible width/height after the initial open. */
        this._growAfterOpen = false;
        /** Whether the overlay's width and height can be constrained to fit within the viewport. */
        this._hasFlexibleDimensions = true;
        /** Whether the overlay position is locked. */
        this._positionLocked = false;
        /** Amount of space that must be maintained between the overlay and the edge of the viewport. */
        this._viewportMargin = 0;
        /** The Scrollable containers used to check scrollable view properties on position change. */
        this._scrollables = [];
        /** Ordered list of preferred positions, from most to least desirable. */
        this._preferredPositions = [];
        /** Subject that emits whenever the position changes. */
        this._positionChanges = new Subject();
        /** Subscription to viewport size changes. */
        this._resizeSubscription = Subscription.EMPTY;
        /** Default offset for the overlay along the x axis. */
        this._offsetX = 0;
        /** Default offset for the overlay along the y axis. */
        this._offsetY = 0;
        /** Keeps track of the CSS classes that the position strategy has applied on the overlay panel. */
        this._appliedPanelClasses = [];
        /** Observable sequence of position changes. */
        this.positionChanges = this._positionChanges;
        this.setOrigin(connectedTo);
    }
    /** Ordered list of preferred positions, from most to least desirable. */
    get positions() {
        return this._preferredPositions;
    }
    /** Attaches this position strategy to an overlay. */
    attach(overlayRef) {
        if (this._overlayRef && overlayRef !== this._overlayRef) {
            throw Error('This position strategy is already attached to an overlay');
        }
        this._validatePositions();
        overlayRef.hostElement.classList.add(boundingBoxClass);
        this._overlayRef = overlayRef;
        this._boundingBox = overlayRef.hostElement;
        this._pane = overlayRef.overlayElement;
        this._isDisposed = false;
        this._isInitialRender = true;
        this._lastPosition = null;
        this._resizeSubscription.unsubscribe();
        this._resizeSubscription = this._viewportRuler.change().subscribe(() => {
            // When the window is resized, we want to trigger the next reposition as if it
            // was an initial render, in order for the strategy to pick a new optimal position,
            // otherwise position locking will cause it to stay at the old one.
            this._isInitialRender = true;
            this.apply();
        });
    }
    /**
     * Updates the position of the overlay element, using whichever preferred position relative
     * to the origin best fits on-screen.
     *
     * The selection of a position goes as follows:
     *  - If any positions fit completely within the viewport as-is,
     *      choose the first position that does so.
     *  - If flexible dimensions are enabled and at least one satisfies the given minimum width/height,
     *      choose the position with the greatest available size modified by the positions' weight.
     *  - If pushing is enabled, take the position that went off-screen the least and push it
     *      on-screen.
     *  - If none of the previous criteria were met, use the position that goes off-screen the least.
     * @docs-private
     */
    apply() {
        // We shouldn't do anything if the strategy was disposed or we're on the server.
        if (this._isDisposed || !this._platform.isBrowser) {
            return;
        }
        // If the position has been applied already (e.g. when the overlay was opened) and the
        // consumer opted into locking in the position, re-use the old position, in order to
        // prevent the overlay from jumping around.
        if (!this._isInitialRender && this._positionLocked && this._lastPosition) {
            this.reapplyLastPosition();
            return;
        }
        this._clearPanelClasses();
        this._resetOverlayElementStyles();
        this._resetBoundingBoxStyles();
        // We need the bounding rects for the origin, the overlay and the container to determine how to position
        // the overlay relative to the origin.
        // We use the viewport rect to determine whether a position would go off-screen.
        this._viewportRect = this._getNarrowedViewportRect();
        this._originRect = this._getOriginRect();
        this._overlayRect = this._pane.getBoundingClientRect();
        this._containerRect = this._overlayContainer.getContainerElement().getBoundingClientRect();
        const originRect = this._originRect;
        const overlayRect = this._overlayRect;
        const viewportRect = this._viewportRect;
        const containerRect = this._containerRect;
        // Positions where the overlay will fit with flexible dimensions.
        const flexibleFits = [];
        // Fallback if none of the preferred positions fit within the viewport.
        let fallback;
        // Go through each of the preferred positions looking for a good fit.
        // If a good fit is found, it will be applied immediately.
        for (let pos of this._preferredPositions) {
            // Get the exact (x, y) coordinate for the point-of-origin on the origin element.
            let originPoint = this._getOriginPoint(originRect, containerRect, pos);
            // From that point-of-origin, get the exact (x, y) coordinate for the top-left corner of the
            // overlay in this position. We use the top-left corner for calculations and later translate
            // this into an appropriate (top, left, bottom, right) style.
            let overlayPoint = this._getOverlayPoint(originPoint, overlayRect, pos);
            // Calculate how well the overlay would fit into the viewport with this point.
            let overlayFit = this._getOverlayFit(overlayPoint, overlayRect, viewportRect, pos);
            // If the overlay, without any further work, fits into the viewport, use this position.
            if (overlayFit.isCompletelyWithinViewport) {
                this._isPushed = false;
                this._applyPosition(pos, originPoint);
                return;
            }
            // If the overlay has flexible dimensions, we can use this position
            // so long as there's enough space for the minimum dimensions.
            if (this._canFitWithFlexibleDimensions(overlayFit, overlayPoint, viewportRect)) {
                // Save positions where the overlay will fit with flexible dimensions. We will use these
                // if none of the positions fit *without* flexible dimensions.
                flexibleFits.push({
                    position: pos,
                    origin: originPoint,
                    overlayRect,
                    boundingBoxRect: this._calculateBoundingBoxRect(originPoint, pos),
                });
                continue;
            }
            // If the current preferred position does not fit on the screen, remember the position
            // if it has more visible area on-screen than we've seen and move onto the next preferred
            // position.
            if (!fallback || fallback.overlayFit.visibleArea < overlayFit.visibleArea) {
                fallback = { overlayFit, overlayPoint, originPoint, position: pos, overlayRect };
            }
        }
        // If there are any positions where the overlay would fit with flexible dimensions, choose the
        // one that has the greatest area available modified by the position's weight
        if (flexibleFits.length) {
            let bestFit = null;
            let bestScore = -1;
            for (const fit of flexibleFits) {
                const score = fit.boundingBoxRect.width * fit.boundingBoxRect.height * (fit.position.weight || 1);
                if (score > bestScore) {
                    bestScore = score;
                    bestFit = fit;
                }
            }
            this._isPushed = false;
            this._applyPosition(bestFit.position, bestFit.origin);
            return;
        }
        // When none of the preferred positions fit within the viewport, take the position
        // that went off-screen the least and attempt to push it on-screen.
        if (this._canPush) {
            // TODO(jelbourn): after pushing, the opening "direction" of the overlay might not make sense.
            this._isPushed = true;
            this._applyPosition(fallback.position, fallback.originPoint);
            return;
        }
        // All options for getting the overlay within the viewport have been exhausted, so go with the
        // position that went off-screen the least.
        this._applyPosition(fallback.position, fallback.originPoint);
    }
    detach() {
        this._clearPanelClasses();
        this._lastPosition = null;
        this._previousPushAmount = null;
        this._resizeSubscription.unsubscribe();
    }
    /** Cleanup after the element gets destroyed. */
    dispose() {
        if (this._isDisposed) {
            return;
        }
        // We can't use `_resetBoundingBoxStyles` here, because it resets
        // some properties to zero, rather than removing them.
        if (this._boundingBox) {
            extendStyles(this._boundingBox.style, {
                top: '',
                left: '',
                right: '',
                bottom: '',
                height: '',
                width: '',
                alignItems: '',
                justifyContent: '',
            });
        }
        if (this._pane) {
            this._resetOverlayElementStyles();
        }
        if (this._overlayRef) {
            this._overlayRef.hostElement.classList.remove(boundingBoxClass);
        }
        this.detach();
        this._positionChanges.complete();
        this._overlayRef = this._boundingBox = null;
        this._isDisposed = true;
    }
    /**
     * This re-aligns the overlay element with the trigger in its last calculated position,
     * even if a position higher in the "preferred positions" list would now fit. This
     * allows one to re-align the panel without changing the orientation of the panel.
     */
    reapplyLastPosition() {
        if (this._isDisposed || !this._platform.isBrowser) {
            return;
        }
        const lastPosition = this._lastPosition;
        if (lastPosition) {
            this._originRect = this._getOriginRect();
            this._overlayRect = this._pane.getBoundingClientRect();
            this._viewportRect = this._getNarrowedViewportRect();
            this._containerRect = this._overlayContainer.getContainerElement().getBoundingClientRect();
            const originPoint = this._getOriginPoint(this._originRect, this._containerRect, lastPosition);
            this._applyPosition(lastPosition, originPoint);
        }
        else {
            this.apply();
        }
    }
    /**
     * Sets the list of Scrollable containers that host the origin element so that
     * on reposition we can evaluate if it or the overlay has been clipped or outside view. Every
     * Scrollable must be an ancestor element of the strategy's origin element.
     */
    withScrollableContainers(scrollables) {
        this._scrollables = scrollables;
        return this;
    }
    /**
     * Adds new preferred positions.
     * @param positions List of positions options for this overlay.
     */
    withPositions(positions) {
        this._preferredPositions = positions;
        // If the last calculated position object isn't part of the positions anymore, clear
        // it in order to avoid it being picked up if the consumer tries to re-apply.
        if (positions.indexOf(this._lastPosition) === -1) {
            this._lastPosition = null;
        }
        this._validatePositions();
        return this;
    }
    /**
     * Sets a minimum distance the overlay may be positioned to the edge of the viewport.
     * @param margin Required margin between the overlay and the viewport edge in pixels.
     */
    withViewportMargin(margin) {
        this._viewportMargin = margin;
        return this;
    }
    /** Sets whether the overlay's width and height can be constrained to fit within the viewport. */
    withFlexibleDimensions(flexibleDimensions = true) {
        this._hasFlexibleDimensions = flexibleDimensions;
        return this;
    }
    /** Sets whether the overlay can grow after the initial open via flexible width/height. */
    withGrowAfterOpen(growAfterOpen = true) {
        this._growAfterOpen = growAfterOpen;
        return this;
    }
    /** Sets whether the overlay can be pushed on-screen if none of the provided positions fit. */
    withPush(canPush = true) {
        this._canPush = canPush;
        return this;
    }
    /**
     * Sets whether the overlay's position should be locked in after it is positioned
     * initially. When an overlay is locked in, it won't attempt to reposition itself
     * when the position is re-applied (e.g. when the user scrolls away).
     * @param isLocked Whether the overlay should locked in.
     */
    withLockedPosition(isLocked = true) {
        this._positionLocked = isLocked;
        return this;
    }
    /**
     * Sets the origin, relative to which to position the overlay.
     * Using an element origin is useful for building components that need to be positioned
     * relatively to a trigger (e.g. dropdown menus or tooltips), whereas using a point can be
     * used for cases like contextual menus which open relative to the user's pointer.
     * @param origin Reference to the new origin.
     */
    setOrigin(origin) {
        this._origin = origin;
        return this;
    }
    /**
     * Sets the default offset for the overlay's connection point on the x-axis.
     * @param offset New offset in the X axis.
     */
    withDefaultOffsetX(offset) {
        this._offsetX = offset;
        return this;
    }
    /**
     * Sets the default offset for the overlay's connection point on the y-axis.
     * @param offset New offset in the Y axis.
     */
    withDefaultOffsetY(offset) {
        this._offsetY = offset;
        return this;
    }
    /**
     * Configures that the position strategy should set a `transform-origin` on some elements
     * inside the overlay, depending on the current position that is being applied. This is
     * useful for the cases where the origin of an animation can change depending on the
     * alignment of the overlay.
     * @param selector CSS selector that will be used to find the target
     *    elements onto which to set the transform origin.
     */
    withTransformOriginOn(selector) {
        this._transformOriginSelector = selector;
        return this;
    }
    /**
     * Gets the (x, y) coordinate of a connection point on the origin based on a relative position.
     */
    _getOriginPoint(originRect, containerRect, pos) {
        let x;
        if (pos.originX == 'center') {
            // Note: when centering we should always use the `left`
            // offset, otherwise the position will be wrong in RTL.
            x = originRect.left + originRect.width / 2;
        }
        else {
            const startX = this._isRtl() ? originRect.right : originRect.left;
            const endX = this._isRtl() ? originRect.left : originRect.right;
            x = pos.originX == 'start' ? startX : endX;
        }
        // When zooming in Safari the container rectangle contains negative values for the position
        // and we need to re-add them to the calculated coordinates.
        if (containerRect.left < 0) {
            x -= containerRect.left;
        }
        let y;
        if (pos.originY == 'center') {
            y = originRect.top + originRect.height / 2;
        }
        else {
            y = pos.originY == 'top' ? originRect.top : originRect.bottom;
        }
        // Normally the containerRect's top value would be zero, however when the overlay is attached to an input
        // (e.g. in an autocomplete), mobile browsers will shift everything in order to put the input in the middle
        // of the screen and to make space for the virtual keyboard. We need to account for this offset,
        // otherwise our positioning will be thrown off.
        // Additionally, when zooming in Safari this fixes the vertical position.
        if (containerRect.top < 0) {
            y -= containerRect.top;
        }
        return { x, y };
    }
    /**
     * Gets the (x, y) coordinate of the top-left corner of the overlay given a given position and
     * origin point to which the overlay should be connected.
     */
    _getOverlayPoint(originPoint, overlayRect, pos) {
        // Calculate the (overlayStartX, overlayStartY), the start of the
        // potential overlay position relative to the origin point.
        let overlayStartX;
        if (pos.overlayX == 'center') {
            overlayStartX = -overlayRect.width / 2;
        }
        else if (pos.overlayX === 'start') {
            overlayStartX = this._isRtl() ? -overlayRect.width : 0;
        }
        else {
            overlayStartX = this._isRtl() ? 0 : -overlayRect.width;
        }
        let overlayStartY;
        if (pos.overlayY == 'center') {
            overlayStartY = -overlayRect.height / 2;
        }
        else {
            overlayStartY = pos.overlayY == 'top' ? 0 : -overlayRect.height;
        }
        // The (x, y) coordinates of the overlay.
        return {
            x: originPoint.x + overlayStartX,
            y: originPoint.y + overlayStartY,
        };
    }
    /** Gets how well an overlay at the given point will fit within the viewport. */
    _getOverlayFit(point, rawOverlayRect, viewport, position) {
        // Round the overlay rect when comparing against the
        // viewport, because the viewport is always rounded.
        const overlay = getRoundedBoundingClientRect(rawOverlayRect);
        let { x, y } = point;
        let offsetX = this._getOffset(position, 'x');
        let offsetY = this._getOffset(position, 'y');
        // Account for the offsets since they could push the overlay out of the viewport.
        if (offsetX) {
            x += offsetX;
        }
        if (offsetY) {
            y += offsetY;
        }
        // How much the overlay would overflow at this position, on each side.
        let leftOverflow = 0 - x;
        let rightOverflow = x + overlay.width - viewport.width;
        let topOverflow = 0 - y;
        let bottomOverflow = y + overlay.height - viewport.height;
        // Visible parts of the element on each axis.
        let visibleWidth = this._subtractOverflows(overlay.width, leftOverflow, rightOverflow);
        let visibleHeight = this._subtractOverflows(overlay.height, topOverflow, bottomOverflow);
        let visibleArea = visibleWidth * visibleHeight;
        return {
            visibleArea,
            isCompletelyWithinViewport: overlay.width * overlay.height === visibleArea,
            fitsInViewportVertically: visibleHeight === overlay.height,
            fitsInViewportHorizontally: visibleWidth == overlay.width,
        };
    }
    /**
     * Whether the overlay can fit within the viewport when it may resize either its width or height.
     * @param fit How well the overlay fits in the viewport at some position.
     * @param point The (x, y) coordinates of the overlay at some position.
     * @param viewport The geometry of the viewport.
     */
    _canFitWithFlexibleDimensions(fit, point, viewport) {
        if (this._hasFlexibleDimensions) {
            const availableHeight = viewport.bottom - point.y;
            const availableWidth = viewport.right - point.x;
            const minHeight = getPixelValue(this._overlayRef.getConfig().minHeight);
            const minWidth = getPixelValue(this._overlayRef.getConfig().minWidth);
            const verticalFit = fit.fitsInViewportVertically || (minHeight != null && minHeight <= availableHeight);
            const horizontalFit = fit.fitsInViewportHorizontally || (minWidth != null && minWidth <= availableWidth);
            return verticalFit && horizontalFit;
        }
        return false;
    }
    /**
     * Gets the point at which the overlay can be "pushed" on-screen. If the overlay is larger than
     * the viewport, the top-left corner will be pushed on-screen (with overflow occurring on the
     * right and bottom).
     *
     * @param start Starting point from which the overlay is pushed.
     * @param rawOverlayRect Dimensions of the overlay.
     * @param scrollPosition Current viewport scroll position.
     * @returns The point at which to position the overlay after pushing. This is effectively a new
     *     originPoint.
     */
    _pushOverlayOnScreen(start, rawOverlayRect, scrollPosition) {
        // If the position is locked and we've pushed the overlay already, reuse the previous push
        // amount, rather than pushing it again. If we were to continue pushing, the element would
        // remain in the viewport, which goes against the expectations when position locking is enabled.
        if (this._previousPushAmount && this._positionLocked) {
            return {
                x: start.x + this._previousPushAmount.x,
                y: start.y + this._previousPushAmount.y,
            };
        }
        // Round the overlay rect when comparing against the
        // viewport, because the viewport is always rounded.
        const overlay = getRoundedBoundingClientRect(rawOverlayRect);
        const viewport = this._viewportRect;
        // Determine how much the overlay goes outside the viewport on each
        // side, which we'll use to decide which direction to push it.
        const overflowRight = Math.max(start.x + overlay.width - viewport.width, 0);
        const overflowBottom = Math.max(start.y + overlay.height - viewport.height, 0);
        const overflowTop = Math.max(viewport.top - scrollPosition.top - start.y, 0);
        const overflowLeft = Math.max(viewport.left - scrollPosition.left - start.x, 0);
        // Amount by which to push the overlay in each axis such that it remains on-screen.
        let pushX = 0;
        let pushY = 0;
        // If the overlay fits completely within the bounds of the viewport, push it from whichever
        // direction is goes off-screen. Otherwise, push the top-left corner such that its in the
        // viewport and allow for the trailing end of the overlay to go out of bounds.
        if (overlay.width <= viewport.width) {
            pushX = overflowLeft || -overflowRight;
        }
        else {
            pushX = start.x < this._viewportMargin ? viewport.left - scrollPosition.left - start.x : 0;
        }
        if (overlay.height <= viewport.height) {
            pushY = overflowTop || -overflowBottom;
        }
        else {
            pushY = start.y < this._viewportMargin ? viewport.top - scrollPosition.top - start.y : 0;
        }
        this._previousPushAmount = { x: pushX, y: pushY };
        return {
            x: start.x + pushX,
            y: start.y + pushY,
        };
    }
    /**
     * Applies a computed position to the overlay and emits a position change.
     * @param position The position preference
     * @param originPoint The point on the origin element where the overlay is connected.
     */
    _applyPosition(position, originPoint) {
        this._setTransformOrigin(position);
        this._setOverlayElementStyles(originPoint, position);
        this._setBoundingBoxStyles(originPoint, position);
        if (position.panelClass) {
            this._addPanelClasses(position.panelClass);
        }
        // Save the last connected position in case the position needs to be re-calculated.
        this._lastPosition = position;
        // Notify that the position has been changed along with its change properties.
        // We only emit if we've got any subscriptions, because the scroll visibility
        // calculations can be somewhat expensive.
        if (this._positionChanges.observers.length) {
            const scrollableViewProperties = this._getScrollVisibility();
            const changeEvent = new ConnectedOverlayPositionChange(position, scrollableViewProperties);
            this._positionChanges.next(changeEvent);
        }
        this._isInitialRender = false;
    }
    /** Sets the transform origin based on the configured selector and the passed-in position.  */
    _setTransformOrigin(position) {
        if (!this._transformOriginSelector) {
            return;
        }
        const elements = this._boundingBox.querySelectorAll(this._transformOriginSelector);
        let xOrigin;
        let yOrigin = position.overlayY;
        if (position.overlayX === 'center') {
            xOrigin = 'center';
        }
        else if (this._isRtl()) {
            xOrigin = position.overlayX === 'start' ? 'right' : 'left';
        }
        else {
            xOrigin = position.overlayX === 'start' ? 'left' : 'right';
        }
        for (let i = 0; i < elements.length; i++) {
            elements[i].style.transformOrigin = `${xOrigin} ${yOrigin}`;
        }
    }
    /**
     * Gets the position and size of the overlay's sizing container.
     *
     * This method does no measuring and applies no styles so that we can cheaply compute the
     * bounds for all positions and choose the best fit based on these results.
     */
    _calculateBoundingBoxRect(origin, position) {
        const viewport = this._viewportRect;
        const isRtl = this._isRtl();
        let height, top, bottom;
        if (position.overlayY === 'top') {
            // Overlay is opening "downward" and thus is bound by the bottom viewport edge.
            top = origin.y;
            height = viewport.height - top + this._viewportMargin;
        }
        else if (position.overlayY === 'bottom') {
            // Overlay is opening "upward" and thus is bound by the top viewport edge. We need to add
            // the viewport margin back in, because the viewport rect is narrowed down to remove the
            // margin, whereas the `origin` position is calculated based on its `DOMRect`.
            bottom = viewport.height - origin.y + this._viewportMargin * 2;
            height = viewport.height - bottom + this._viewportMargin;
        }
        else {
            // If neither top nor bottom, it means that the overlay is vertically centered on the
            // origin point. Note that we want the position relative to the viewport, rather than
            // the page, which is why we don't use something like `viewport.bottom - origin.y` and
            // `origin.y - viewport.top`.
            const smallestDistanceToViewportEdge = Math.min(viewport.bottom - origin.y + viewport.top, origin.y);
            const previousHeight = this._lastBoundingBoxSize.height;
            height = smallestDistanceToViewportEdge * 2;
            top = origin.y - smallestDistanceToViewportEdge;
            if (height > previousHeight && !this._isInitialRender && !this._growAfterOpen) {
                top = origin.y - previousHeight / 2;
            }
        }
        // The overlay is opening 'right-ward' (the content flows to the right).
        const isBoundedByRightViewportEdge = (position.overlayX === 'start' && !isRtl) || (position.overlayX === 'end' && isRtl);
        // The overlay is opening 'left-ward' (the content flows to the left).
        const isBoundedByLeftViewportEdge = (position.overlayX === 'end' && !isRtl) || (position.overlayX === 'start' && isRtl);
        let width, left, right;
        if (isBoundedByLeftViewportEdge) {
            right = viewport.width - origin.x + this._viewportMargin;
            width = origin.x - this._viewportMargin;
        }
        else if (isBoundedByRightViewportEdge) {
            left = origin.x;
            width = viewport.right - origin.x;
        }
        else {
            // If neither start nor end, it means that the overlay is horizontally centered on the
            // origin point. Note that we want the position relative to the viewport, rather than
            // the page, which is why we don't use something like `viewport.right - origin.x` and
            // `origin.x - viewport.left`.
            const smallestDistanceToViewportEdge = Math.min(viewport.right - origin.x + viewport.left, origin.x);
            const previousWidth = this._lastBoundingBoxSize.width;
            width = smallestDistanceToViewportEdge * 2;
            left = origin.x - smallestDistanceToViewportEdge;
            if (width > previousWidth && !this._isInitialRender && !this._growAfterOpen) {
                left = origin.x - previousWidth / 2;
            }
        }
        return { top: top, left: left, bottom: bottom, right: right, width, height };
    }
    /**
     * Sets the position and size of the overlay's sizing wrapper. The wrapper is positioned on the
     * origin's connection point and stretches to the bounds of the viewport.
     *
     * @param origin The point on the origin element where the overlay is connected.
     * @param position The position preference
     */
    _setBoundingBoxStyles(origin, position) {
        const boundingBoxRect = this._calculateBoundingBoxRect(origin, position);
        // It's weird if the overlay *grows* while scrolling, so we take the last size into account
        // when applying a new size.
        if (!this._isInitialRender && !this._growAfterOpen) {
            boundingBoxRect.height = Math.min(boundingBoxRect.height, this._lastBoundingBoxSize.height);
            boundingBoxRect.width = Math.min(boundingBoxRect.width, this._lastBoundingBoxSize.width);
        }
        const styles = {};
        if (this._hasExactPosition()) {
            styles.top = styles.left = '0';
            styles.bottom = styles.right = styles.maxHeight = styles.maxWidth = '';
            styles.width = styles.height = '100%';
        }
        else {
            const maxHeight = this._overlayRef.getConfig().maxHeight;
            const maxWidth = this._overlayRef.getConfig().maxWidth;
            styles.height = coerceCssPixelValue(boundingBoxRect.height);
            styles.top = coerceCssPixelValue(boundingBoxRect.top);
            styles.bottom = coerceCssPixelValue(boundingBoxRect.bottom);
            styles.width = coerceCssPixelValue(boundingBoxRect.width);
            styles.left = coerceCssPixelValue(boundingBoxRect.left);
            styles.right = coerceCssPixelValue(boundingBoxRect.right);
            // Push the pane content towards the proper direction.
            if (position.overlayX === 'center') {
                styles.alignItems = 'center';
            }
            else {
                styles.alignItems = position.overlayX === 'end' ? 'flex-end' : 'flex-start';
            }
            if (position.overlayY === 'center') {
                styles.justifyContent = 'center';
            }
            else {
                styles.justifyContent = position.overlayY === 'bottom' ? 'flex-end' : 'flex-start';
            }
            if (maxHeight) {
                styles.maxHeight = coerceCssPixelValue(maxHeight);
            }
            if (maxWidth) {
                styles.maxWidth = coerceCssPixelValue(maxWidth);
            }
        }
        this._lastBoundingBoxSize = boundingBoxRect;
        extendStyles(this._boundingBox.style, styles);
    }
    /** Resets the styles for the bounding box so that a new positioning can be computed. */
    _resetBoundingBoxStyles() {
        extendStyles(this._boundingBox.style, {
            top: '0',
            left: '0',
            right: '0',
            bottom: '0',
            height: '',
            width: '',
            alignItems: '',
            justifyContent: '',
        });
    }
    /** Resets the styles for the overlay pane so that a new positioning can be computed. */
    _resetOverlayElementStyles() {
        extendStyles(this._pane.style, {
            top: '',
            left: '',
            bottom: '',
            right: '',
            position: '',
            transform: '',
        });
    }
    /** Sets positioning styles to the overlay element. */
    _setOverlayElementStyles(originPoint, position) {
        const styles = {};
        const hasExactPosition = this._hasExactPosition();
        const hasFlexibleDimensions = this._hasFlexibleDimensions;
        const config = this._overlayRef.getConfig();
        if (hasExactPosition) {
            const scrollPosition = this._viewportRuler.getViewportScrollPosition();
            extendStyles(styles, this._getExactOverlayY(position, originPoint, scrollPosition));
            extendStyles(styles, this._getExactOverlayX(position, originPoint, scrollPosition));
        }
        else {
            styles.position = 'static';
        }
        // Use a transform to apply the offsets. We do this because the `center` positions rely on
        // being in the normal flex flow and setting a `top` / `left` at all will completely throw
        // off the position. We also can't use margins, because they won't have an effect in some
        // cases where the element doesn't have anything to "push off of". Finally, this works
        // better both with flexible and non-flexible positioning.
        let transformString = '';
        let offsetX = this._getOffset(position, 'x');
        let offsetY = this._getOffset(position, 'y');
        if (offsetX) {
            transformString += `translateX(${offsetX}px) `;
        }
        if (offsetY) {
            transformString += `translateY(${offsetY}px)`;
        }
        styles.transform = transformString.trim();
        // If a maxWidth or maxHeight is specified on the overlay, we remove them. We do this because
        // we need these values to both be set to "100%" for the automatic flexible sizing to work.
        // The maxHeight and maxWidth are set on the boundingBox in order to enforce the constraint.
        // Note that this doesn't apply when we have an exact position, in which case we do want to
        // apply them because they'll be cleared from the bounding box.
        if (config.maxHeight) {
            if (hasExactPosition) {
                styles.maxHeight = coerceCssPixelValue(config.maxHeight);
            }
            else if (hasFlexibleDimensions) {
                styles.maxHeight = '';
            }
        }
        if (config.maxWidth) {
            if (hasExactPosition) {
                styles.maxWidth = coerceCssPixelValue(config.maxWidth);
            }
            else if (hasFlexibleDimensions) {
                styles.maxWidth = '';
            }
        }
        extendStyles(this._pane.style, styles);
    }
    /** Gets the exact top/bottom for the overlay when not using flexible sizing or when pushing. */
    _getExactOverlayY(position, originPoint, scrollPosition) {
        // Reset any existing styles. This is necessary in case the
        // preferred position has changed since the last `apply`.
        let styles = { top: '', bottom: '' };
        let overlayPoint = this._getOverlayPoint(originPoint, this._overlayRect, position);
        if (this._isPushed) {
            overlayPoint = this._pushOverlayOnScreen(overlayPoint, this._overlayRect, scrollPosition);
        }
        // We want to set either `top` or `bottom` based on whether the overlay wants to appear
        // above or below the origin and the direction in which the element will expand.
        if (position.overlayY === 'bottom') {
            // When using `bottom`, we adjust the y position such that it is the distance
            // from the bottom of the viewport rather than the top.
            const documentHeight = this._document.documentElement.clientHeight;
            styles.bottom = `${documentHeight - (overlayPoint.y + this._overlayRect.height)}px`;
        }
        else {
            styles.top = coerceCssPixelValue(overlayPoint.y);
        }
        return styles;
    }
    /** Gets the exact left/right for the overlay when not using flexible sizing or when pushing. */
    _getExactOverlayX(position, originPoint, scrollPosition) {
        // Reset any existing styles. This is necessary in case the preferred position has
        // changed since the last `apply`.
        let styles = { left: '', right: '' };
        let overlayPoint = this._getOverlayPoint(originPoint, this._overlayRect, position);
        if (this._isPushed) {
            overlayPoint = this._pushOverlayOnScreen(overlayPoint, this._overlayRect, scrollPosition);
        }
        // We want to set either `left` or `right` based on whether the overlay wants to appear "before"
        // or "after" the origin, which determines the direction in which the element will expand.
        // For the horizontal axis, the meaning of "before" and "after" change based on whether the
        // page is in RTL or LTR.
        let horizontalStyleProperty;
        if (this._isRtl()) {
            horizontalStyleProperty = position.overlayX === 'end' ? 'left' : 'right';
        }
        else {
            horizontalStyleProperty = position.overlayX === 'end' ? 'right' : 'left';
        }
        // When we're setting `right`, we adjust the x position such that it is the distance
        // from the right edge of the viewport rather than the left edge.
        if (horizontalStyleProperty === 'right') {
            const documentWidth = this._document.documentElement.clientWidth;
            styles.right = `${documentWidth - (overlayPoint.x + this._overlayRect.width)}px`;
        }
        else {
            styles.left = coerceCssPixelValue(overlayPoint.x);
        }
        return styles;
    }
    /**
     * Gets the view properties of the trigger and overlay, including whether they are clipped
     * or completely outside the view of any of the strategy's scrollables.
     */
    _getScrollVisibility() {
        // Note: needs fresh rects since the position could've changed.
        const originBounds = this._getOriginRect();
        const overlayBounds = this._pane.getBoundingClientRect();
        // TODO(jelbourn): instead of needing all of the client rects for these scrolling containers
        // every time, we should be able to use the scrollTop of the containers if the size of those
        // containers hasn't changed.
        const scrollContainerBounds = this._scrollables.map(scrollable => {
            return scrollable.getElementRef().nativeElement.getBoundingClientRect();
        });
        return {
            isOriginClipped: isElementClippedByScrolling(originBounds, scrollContainerBounds),
            isOriginOutsideView: isElementScrolledOutsideView(originBounds, scrollContainerBounds),
            isOverlayClipped: isElementClippedByScrolling(overlayBounds, scrollContainerBounds),
            isOverlayOutsideView: isElementScrolledOutsideView(overlayBounds, scrollContainerBounds),
        };
    }
    /** Subtracts the amount that an element is overflowing on an axis from its length. */
    _subtractOverflows(length, ...overflows) {
        return overflows.reduce((currentValue, currentOverflow) => {
            return currentValue - Math.max(currentOverflow, 0);
        }, length);
    }
    /** Narrows the given viewport rect by the current _viewportMargin. */
    _getNarrowedViewportRect() {
        // We recalculate the viewport rect here ourselves, rather than using the ViewportRuler,
        // because we want to use the `clientWidth` and `clientHeight` as the base. The difference
        // being that the client properties don't include the scrollbar, as opposed to `innerWidth`
        // and `innerHeight` that do. This is necessary, because the overlay container uses
        // 100% `width` and `height` which don't include the scrollbar either.
        const width = this._document.documentElement.clientWidth;
        const height = this._document.documentElement.clientHeight;
        const scrollPosition = this._viewportRuler.getViewportScrollPosition();
        return {
            top: scrollPosition.top + this._viewportMargin,
            left: scrollPosition.left + this._viewportMargin,
            right: scrollPosition.left + width - this._viewportMargin,
            bottom: scrollPosition.top + height - this._viewportMargin,
            width: width - 2 * this._viewportMargin,
            height: height - 2 * this._viewportMargin,
        };
    }
    /** Whether the we're dealing with an RTL context */
    _isRtl() {
        return this._overlayRef.getDirection() === 'rtl';
    }
    /** Determines whether the overlay uses exact or flexible positioning. */
    _hasExactPosition() {
        return !this._hasFlexibleDimensions || this._isPushed;
    }
    /** Retrieves the offset of a position along the x or y axis. */
    _getOffset(position, axis) {
        if (axis === 'x') {
            // We don't do something like `position['offset' + axis]` in
            // order to avoid breaking minifiers that rename properties.
            return position.offsetX == null ? this._offsetX : position.offsetX;
        }
        return position.offsetY == null ? this._offsetY : position.offsetY;
    }
    /** Validates that the current position match the expected values. */
    _validatePositions() {
        if (true) {
            if (!this._preferredPositions.length) {
                throw Error('FlexibleConnectedPositionStrategy: At least one position is required.');
            }
            // TODO(crisbeto): remove these once Angular's template type
            // checking is advanced enough to catch these cases.
            this._preferredPositions.forEach(pair => {
                validateHorizontalPosition('originX', pair.originX);
                validateVerticalPosition('originY', pair.originY);
                validateHorizontalPosition('overlayX', pair.overlayX);
                validateVerticalPosition('overlayY', pair.overlayY);
            });
        }
    }
    /** Adds a single CSS class or an array of classes on the overlay panel. */
    _addPanelClasses(cssClasses) {
        if (this._pane) {
            coerceArray(cssClasses).forEach(cssClass => {
                if (cssClass !== '' && this._appliedPanelClasses.indexOf(cssClass) === -1) {
                    this._appliedPanelClasses.push(cssClass);
                    this._pane.classList.add(cssClass);
                }
            });
        }
    }
    /** Clears the classes that the position strategy has applied from the overlay panel. */
    _clearPanelClasses() {
        if (this._pane) {
            this._appliedPanelClasses.forEach(cssClass => {
                this._pane.classList.remove(cssClass);
            });
            this._appliedPanelClasses = [];
        }
    }
    /** Returns the DOMRect of the current origin. */
    _getOriginRect() {
        const origin = this._origin;
        if (origin instanceof ElementRef) {
            return origin.nativeElement.getBoundingClientRect();
        }
        // Check for Element so SVG elements are also supported.
        if (origin instanceof Element) {
            return origin.getBoundingClientRect();
        }
        const width = origin.width || 0;
        const height = origin.height || 0;
        // If the origin is a point, return a client rect as if it was a 0x0 element at the point.
        return {
            top: origin.y,
            bottom: origin.y + height,
            left: origin.x,
            right: origin.x + width,
            height,
            width,
        };
    }
}
/** Shallow-extends a stylesheet object with another stylesheet object. */
function extendStyles(destination, source) {
    for (let key in source) {
        if (source.hasOwnProperty(key)) {
            destination[key] = source[key];
        }
    }
    return destination;
}
/**
 * Extracts the pixel value as a number from a value, if it's a number
 * or a CSS pixel string (e.g. `1337px`). Otherwise returns null.
 */
function getPixelValue(input) {
    if (typeof input !== 'number' && input != null) {
        const [value, units] = input.split(cssUnitPattern);
        return !units || units === 'px' ? parseFloat(value) : null;
    }
    return input || null;
}
/**
 * Gets a version of an element's bounding `DOMRect` where all the values are rounded down to
 * the nearest pixel. This allows us to account for the cases where there may be sub-pixel
 * deviations in the `DOMRect` returned by the browser (e.g. when zoomed in with a percentage
 * size, see #21350).
 */
function getRoundedBoundingClientRect(clientRect) {
    return {
        top: Math.floor(clientRect.top),
        right: Math.floor(clientRect.right),
        bottom: Math.floor(clientRect.bottom),
        left: Math.floor(clientRect.left),
        width: Math.floor(clientRect.width),
        height: Math.floor(clientRect.height),
    };
}
export const STANDARD_DROPDOWN_BELOW_POSITIONS = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
];
export const STANDARD_DROPDOWN_ADJACENT_POSITIONS = [
    { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top' },
    { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'bottom' },
    { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top' },
    { originX: 'start', originY: 'bottom', overlayX: 'end', overlayY: 'bottom' },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZmxleGlibGUtY29ubmVjdGVkLXBvc2l0aW9uLXN0cmF0ZWd5LXYxNy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL25neC1oZWxwLWV4dC9zcmMvbGliL2hlbHAtZXh0L2ZsZXhpYmxlLWNvbm5lY3RlZC1wb3NpdGlvbi1zdHJhdGVneS12MTcudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7OztHQU1HO0FBRUgsT0FBTyxFQUFFLFdBQVcsRUFBRSxtQkFBbUIsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ3pFLE9BQU8sRUFDTCw4QkFBOEIsRUFNOUIsMEJBQTBCLEVBQzFCLHdCQUF3QixHQUN6QixNQUFNLHNCQUFzQixDQUFDO0FBRzlCLE9BQU8sRUFBRSxVQUFVLEVBQUUsTUFBTSxlQUFlLENBQUM7QUFDM0MsT0FBTyxFQUFjLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxNQUFNLENBQUM7QUFDekQsT0FBTyxFQUFFLDJCQUEyQixFQUFFLDRCQUE0QixFQUFFLE1BQU0sbUJBQW1CLENBQUM7QUFFOUYscUZBQXFGO0FBQ3JGLDZGQUE2RjtBQUU3RixxREFBcUQ7QUFDckQsTUFBTSxnQkFBZ0IsR0FBRyw2Q0FBNkMsQ0FBQztBQUV2RSxxREFBcUQ7QUFDckQsTUFBTSxjQUFjLEdBQUcsZUFBZSxDQUFDO0FBY3ZDOzs7Ozs7R0FNRztBQUNILE1BQU0sT0FBTyxtQ0FBbUM7SUE2RjlDLFlBQ0UsV0FBb0QsRUFDNUMsY0FBNkIsRUFDN0IsU0FBbUIsRUFDbkIsU0FBbUIsRUFDbkIsaUJBQW1DO1FBSG5DLG1CQUFjLEdBQWQsY0FBYyxDQUFlO1FBQzdCLGNBQVMsR0FBVCxTQUFTLENBQVU7UUFDbkIsY0FBUyxHQUFULFNBQVMsQ0FBVTtRQUNuQixzQkFBaUIsR0FBakIsaUJBQWlCLENBQWtCO1FBM0Y3QywwRkFBMEY7UUFDbEYseUJBQW9CLEdBQUcsRUFBRSxLQUFLLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxDQUFDLEVBQUUsQ0FBQztRQUV2RCxnRUFBZ0U7UUFDeEQsY0FBUyxHQUFHLEtBQUssQ0FBQztRQUUxQix1RUFBdUU7UUFDL0QsYUFBUSxHQUFHLElBQUksQ0FBQztRQUV4QixxRkFBcUY7UUFDN0UsbUJBQWMsR0FBRyxLQUFLLENBQUM7UUFFL0IsNEZBQTRGO1FBQ3BGLDJCQUFzQixHQUFHLElBQUksQ0FBQztRQUV0Qyw4Q0FBOEM7UUFDdEMsb0JBQWUsR0FBRyxLQUFLLENBQUM7UUFjaEMsZ0dBQWdHO1FBQ3hGLG9CQUFlLEdBQUcsQ0FBQyxDQUFDO1FBRTVCLDZGQUE2RjtRQUNyRixpQkFBWSxHQUFvQixFQUFFLENBQUM7UUFFM0MseUVBQXlFO1FBQ3pFLHdCQUFtQixHQUE2QixFQUFFLENBQUM7UUFvQm5ELHdEQUF3RDtRQUN2QyxxQkFBZ0IsR0FBRyxJQUFJLE9BQU8sRUFBa0MsQ0FBQztRQUVsRiw2Q0FBNkM7UUFDckMsd0JBQW1CLEdBQUcsWUFBWSxDQUFDLEtBQUssQ0FBQztRQUVqRCx1REFBdUQ7UUFDL0MsYUFBUSxHQUFHLENBQUMsQ0FBQztRQUVyQix1REFBdUQ7UUFDL0MsYUFBUSxHQUFHLENBQUMsQ0FBQztRQUtyQixrR0FBa0c7UUFDMUYseUJBQW9CLEdBQWEsRUFBRSxDQUFDO1FBSzVDLCtDQUErQztRQUMvQyxvQkFBZSxHQUErQyxJQUFJLENBQUMsZ0JBQWdCLENBQUM7UUFjbEYsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsQ0FBQztJQUM5QixDQUFDO0lBYkQseUVBQXlFO0lBQ3pFLElBQUksU0FBUztRQUNYLE9BQU8sSUFBSSxDQUFDLG1CQUFtQixDQUFDO0lBQ2xDLENBQUM7SUFZRCxxREFBcUQ7SUFDckQsTUFBTSxDQUFDLFVBQXNCO1FBQzNCLElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxVQUFVLEtBQUssSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUN2RCxNQUFNLEtBQUssQ0FBQywwREFBMEQsQ0FBQyxDQUFDO1NBQ3pFO1FBRUQsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFFMUIsVUFBVSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLENBQUM7UUFFdkQsSUFBSSxDQUFDLFdBQVcsR0FBRyxVQUFVLENBQUM7UUFDOUIsSUFBSSxDQUFDLFlBQVksR0FBRyxVQUFVLENBQUMsV0FBVyxDQUFDO1FBQzNDLElBQUksQ0FBQyxLQUFLLEdBQUcsVUFBVSxDQUFDLGNBQWMsQ0FBQztRQUN2QyxJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztRQUN6QixJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDO1FBQzdCLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO1FBQzFCLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXLEVBQUUsQ0FBQztRQUN2QyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFO1lBQ3JFLDhFQUE4RTtZQUM5RSxtRkFBbUY7WUFDbkYsbUVBQW1FO1lBQ25FLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUM7WUFDN0IsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBQ2YsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7Ozs7Ozs7Ozs7T0FhRztJQUNILEtBQUs7UUFDSCxnRkFBZ0Y7UUFDaEYsSUFBSSxJQUFJLENBQUMsV0FBVyxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLEVBQUU7WUFDakQsT0FBTztTQUNSO1FBRUQsc0ZBQXNGO1FBQ3RGLG9GQUFvRjtRQUNwRiwyQ0FBMkM7UUFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsZUFBZSxJQUFJLElBQUksQ0FBQyxhQUFhLEVBQUU7WUFDeEUsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDM0IsT0FBTztTQUNSO1FBRUQsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLDBCQUEwQixFQUFFLENBQUM7UUFDbEMsSUFBSSxDQUFDLHVCQUF1QixFQUFFLENBQUM7UUFFL0Isd0dBQXdHO1FBQ3hHLHNDQUFzQztRQUN0QyxnRkFBZ0Y7UUFDaEYsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsd0JBQXdCLEVBQUUsQ0FBQztRQUNyRCxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxjQUFjLEVBQUUsQ0FBQztRQUN6QyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUN2RCxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFFM0YsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQztRQUNwQyxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDO1FBQ3RDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7UUFDeEMsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQztRQUUxQyxpRUFBaUU7UUFDakUsTUFBTSxZQUFZLEdBQWtCLEVBQUUsQ0FBQztRQUV2Qyx1RUFBdUU7UUFDdkUsSUFBSSxRQUFzQyxDQUFDO1FBRTNDLHFFQUFxRTtRQUNyRSwwREFBMEQ7UUFDMUQsS0FBSyxJQUFJLEdBQUcsSUFBSSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7WUFDeEMsaUZBQWlGO1lBQ2pGLElBQUksV0FBVyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxFQUFFLGFBQWEsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUV2RSw0RkFBNEY7WUFDNUYsNEZBQTRGO1lBQzVGLDZEQUE2RDtZQUM3RCxJQUFJLFlBQVksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxHQUFHLENBQUMsQ0FBQztZQUV4RSw4RUFBOEU7WUFDOUUsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxHQUFHLENBQUMsQ0FBQztZQUVuRix1RkFBdUY7WUFDdkYsSUFBSSxVQUFVLENBQUMsMEJBQTBCLEVBQUU7Z0JBQ3pDLElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO2dCQUN2QixJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRSxXQUFXLENBQUMsQ0FBQztnQkFDdEMsT0FBTzthQUNSO1lBRUQsbUVBQW1FO1lBQ25FLDhEQUE4RDtZQUM5RCxJQUFJLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxVQUFVLEVBQUUsWUFBWSxFQUFFLFlBQVksQ0FBQyxFQUFFO2dCQUM5RSx3RkFBd0Y7Z0JBQ3hGLDhEQUE4RDtnQkFDOUQsWUFBWSxDQUFDLElBQUksQ0FBQztvQkFDaEIsUUFBUSxFQUFFLEdBQUc7b0JBQ2IsTUFBTSxFQUFFLFdBQVc7b0JBQ25CLFdBQVc7b0JBQ1gsZUFBZSxFQUFFLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxXQUFXLEVBQUUsR0FBRyxDQUFDO2lCQUNsRSxDQUFDLENBQUM7Z0JBRUgsU0FBUzthQUNWO1lBRUQsc0ZBQXNGO1lBQ3RGLHlGQUF5RjtZQUN6RixZQUFZO1lBQ1osSUFBSSxDQUFDLFFBQVEsSUFBSSxRQUFRLENBQUMsVUFBVSxDQUFDLFdBQVcsR0FBRyxVQUFVLENBQUMsV0FBVyxFQUFFO2dCQUN6RSxRQUFRLEdBQUcsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsR0FBRyxFQUFFLFdBQVcsRUFBRSxDQUFDO2FBQ2xGO1NBQ0Y7UUFFRCw4RkFBOEY7UUFDOUYsNkVBQTZFO1FBQzdFLElBQUksWUFBWSxDQUFDLE1BQU0sRUFBRTtZQUN2QixJQUFJLE9BQU8sR0FBdUIsSUFBSSxDQUFDO1lBQ3ZDLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQyxDQUFDO1lBQ25CLEtBQUssTUFBTSxHQUFHLElBQUksWUFBWSxFQUFFO2dCQUM5QixNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsZUFBZSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUMsZUFBZSxDQUFDLE1BQU0sR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDO2dCQUNsRyxJQUFJLEtBQUssR0FBRyxTQUFTLEVBQUU7b0JBQ3JCLFNBQVMsR0FBRyxLQUFLLENBQUM7b0JBQ2xCLE9BQU8sR0FBRyxHQUFHLENBQUM7aUJBQ2Y7YUFDRjtZQUVELElBQUksQ0FBQyxTQUFTLEdBQUcsS0FBSyxDQUFDO1lBQ3ZCLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBUSxDQUFDLFFBQVEsRUFBRSxPQUFRLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDeEQsT0FBTztTQUNSO1FBRUQsa0ZBQWtGO1FBQ2xGLG1FQUFtRTtRQUNuRSxJQUFJLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDakIsOEZBQThGO1lBQzlGLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDO1lBQ3RCLElBQUksQ0FBQyxjQUFjLENBQUMsUUFBUyxDQUFDLFFBQVEsRUFBRSxRQUFTLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDL0QsT0FBTztTQUNSO1FBRUQsOEZBQThGO1FBQzlGLDJDQUEyQztRQUMzQyxJQUFJLENBQUMsY0FBYyxDQUFDLFFBQVMsQ0FBQyxRQUFRLEVBQUUsUUFBUyxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFRCxNQUFNO1FBQ0osSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFDMUIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7UUFDMUIsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksQ0FBQztRQUNoQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsV0FBVyxFQUFFLENBQUM7SUFDekMsQ0FBQztJQUVELGdEQUFnRDtJQUNoRCxPQUFPO1FBQ0wsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ3BCLE9BQU87U0FDUjtRQUVELGlFQUFpRTtRQUNqRSxzREFBc0Q7UUFDdEQsSUFBSSxJQUFJLENBQUMsWUFBWSxFQUFFO1lBQ3JCLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRTtnQkFDcEMsR0FBRyxFQUFFLEVBQUU7Z0JBQ1AsSUFBSSxFQUFFLEVBQUU7Z0JBQ1IsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsTUFBTSxFQUFFLEVBQUU7Z0JBQ1YsTUFBTSxFQUFFLEVBQUU7Z0JBQ1YsS0FBSyxFQUFFLEVBQUU7Z0JBQ1QsVUFBVSxFQUFFLEVBQUU7Z0JBQ2QsY0FBYyxFQUFFLEVBQUU7YUFDSSxDQUFDLENBQUM7U0FDM0I7UUFFRCxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDZCxJQUFJLENBQUMsMEJBQTBCLEVBQUUsQ0FBQztTQUNuQztRQUVELElBQUksSUFBSSxDQUFDLFdBQVcsRUFBRTtZQUNwQixJQUFJLENBQUMsV0FBVyxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGdCQUFnQixDQUFDLENBQUM7U0FDakU7UUFFRCxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7UUFDZCxJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDakMsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUssQ0FBQztRQUM3QyxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztJQUMxQixDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILG1CQUFtQjtRQUNqQixJQUFJLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsRUFBRTtZQUNqRCxPQUFPO1NBQ1I7UUFFRCxNQUFNLFlBQVksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDO1FBRXhDLElBQUksWUFBWSxFQUFFO1lBQ2hCLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1lBQ3pDLElBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBQ3ZELElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLHdCQUF3QixFQUFFLENBQUM7WUFDckQsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsaUJBQWlCLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1lBRTNGLE1BQU0sV0FBVyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsY0FBYyxFQUFFLFlBQVksQ0FBQyxDQUFDO1lBQzlGLElBQUksQ0FBQyxjQUFjLENBQUMsWUFBWSxFQUFFLFdBQVcsQ0FBQyxDQUFDO1NBQ2hEO2FBQU07WUFDTCxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7U0FDZDtJQUNILENBQUM7SUFFRDs7OztPQUlHO0lBQ0gsd0JBQXdCLENBQUMsV0FBNEI7UUFDbkQsSUFBSSxDQUFDLFlBQVksR0FBRyxXQUFXLENBQUM7UUFDaEMsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsYUFBYSxDQUFDLFNBQThCO1FBQzFDLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxTQUFTLENBQUM7UUFFckMsb0ZBQW9GO1FBQ3BGLDZFQUE2RTtRQUM3RSxJQUFJLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLGFBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFO1lBQ2pELElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO1NBQzNCO1FBRUQsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7UUFFMUIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsa0JBQWtCLENBQUMsTUFBYztRQUMvQixJQUFJLENBQUMsZUFBZSxHQUFHLE1BQU0sQ0FBQztRQUM5QixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxpR0FBaUc7SUFDakcsc0JBQXNCLENBQUMsa0JBQWtCLEdBQUcsSUFBSTtRQUM5QyxJQUFJLENBQUMsc0JBQXNCLEdBQUcsa0JBQWtCLENBQUM7UUFDakQsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQsMEZBQTBGO0lBQzFGLGlCQUFpQixDQUFDLGFBQWEsR0FBRyxJQUFJO1FBQ3BDLElBQUksQ0FBQyxjQUFjLEdBQUcsYUFBYSxDQUFDO1FBQ3BDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELDhGQUE4RjtJQUM5RixRQUFRLENBQUMsT0FBTyxHQUFHLElBQUk7UUFDckIsSUFBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7UUFDeEIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxrQkFBa0IsQ0FBQyxRQUFRLEdBQUcsSUFBSTtRQUNoQyxJQUFJLENBQUMsZUFBZSxHQUFHLFFBQVEsQ0FBQztRQUNoQyxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSCxTQUFTLENBQUMsTUFBK0M7UUFDdkQsSUFBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFDdEIsT0FBTyxJQUFJLENBQUM7SUFDZCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsa0JBQWtCLENBQUMsTUFBYztRQUMvQixJQUFJLENBQUMsUUFBUSxHQUFHLE1BQU0sQ0FBQztRQUN2QixPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRDs7O09BR0c7SUFDSCxrQkFBa0IsQ0FBQyxNQUFjO1FBQy9CLElBQUksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDO1FBQ3ZCLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOzs7Ozs7O09BT0c7SUFDSCxxQkFBcUIsQ0FBQyxRQUFnQjtRQUNwQyxJQUFJLENBQUMsd0JBQXdCLEdBQUcsUUFBUSxDQUFDO1FBQ3pDLE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVEOztPQUVHO0lBQ0ssZUFBZSxDQUFDLFVBQXNCLEVBQUUsYUFBeUIsRUFBRSxHQUFzQjtRQUMvRixJQUFJLENBQVMsQ0FBQztRQUNkLElBQUksR0FBRyxDQUFDLE9BQU8sSUFBSSxRQUFRLEVBQUU7WUFDM0IsdURBQXVEO1lBQ3ZELHVEQUF1RDtZQUN2RCxDQUFDLEdBQUcsVUFBVSxDQUFDLElBQUksR0FBRyxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztTQUM1QzthQUFNO1lBQ0wsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1lBQ2xFLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQztZQUNoRSxDQUFDLEdBQUcsR0FBRyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDO1NBQzVDO1FBRUQsMkZBQTJGO1FBQzNGLDREQUE0RDtRQUM1RCxJQUFJLGFBQWEsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxFQUFFO1lBQzFCLENBQUMsSUFBSSxhQUFhLENBQUMsSUFBSSxDQUFDO1NBQ3pCO1FBRUQsSUFBSSxDQUFTLENBQUM7UUFDZCxJQUFJLEdBQUcsQ0FBQyxPQUFPLElBQUksUUFBUSxFQUFFO1lBQzNCLENBQUMsR0FBRyxVQUFVLENBQUMsR0FBRyxHQUFHLFVBQVUsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO1NBQzVDO2FBQU07WUFDTCxDQUFDLEdBQUcsR0FBRyxDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUM7U0FDL0Q7UUFFRCx5R0FBeUc7UUFDekcsMkdBQTJHO1FBQzNHLGdHQUFnRztRQUNoRyxnREFBZ0Q7UUFDaEQseUVBQXlFO1FBQ3pFLElBQUksYUFBYSxDQUFDLEdBQUcsR0FBRyxDQUFDLEVBQUU7WUFDekIsQ0FBQyxJQUFJLGFBQWEsQ0FBQyxHQUFHLENBQUM7U0FDeEI7UUFFRCxPQUFPLEVBQUUsQ0FBQyxFQUFFLENBQUMsRUFBRSxDQUFDO0lBQ2xCLENBQUM7SUFFRDs7O09BR0c7SUFDSyxnQkFBZ0IsQ0FBQyxXQUFrQixFQUFFLFdBQXVCLEVBQUUsR0FBc0I7UUFDMUYsaUVBQWlFO1FBQ2pFLDJEQUEyRDtRQUMzRCxJQUFJLGFBQXFCLENBQUM7UUFDMUIsSUFBSSxHQUFHLENBQUMsUUFBUSxJQUFJLFFBQVEsRUFBRTtZQUM1QixhQUFhLEdBQUcsQ0FBQyxXQUFXLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztTQUN4QzthQUFNLElBQUksR0FBRyxDQUFDLFFBQVEsS0FBSyxPQUFPLEVBQUU7WUFDbkMsYUFBYSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDeEQ7YUFBTTtZQUNMLGFBQWEsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDO1NBQ3hEO1FBRUQsSUFBSSxhQUFxQixDQUFDO1FBQzFCLElBQUksR0FBRyxDQUFDLFFBQVEsSUFBSSxRQUFRLEVBQUU7WUFDNUIsYUFBYSxHQUFHLENBQUMsV0FBVyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7U0FDekM7YUFBTTtZQUNMLGFBQWEsR0FBRyxHQUFHLENBQUMsUUFBUSxJQUFJLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUM7U0FDakU7UUFFRCx5Q0FBeUM7UUFDekMsT0FBTztZQUNMLENBQUMsRUFBRSxXQUFXLENBQUMsQ0FBQyxHQUFHLGFBQWE7WUFDaEMsQ0FBQyxFQUFFLFdBQVcsQ0FBQyxDQUFDLEdBQUcsYUFBYTtTQUNqQyxDQUFDO0lBQ0osQ0FBQztJQUVELGdGQUFnRjtJQUN4RSxjQUFjLENBQ3BCLEtBQVksRUFDWixjQUEwQixFQUMxQixRQUFvQixFQUNwQixRQUEyQjtRQUUzQixvREFBb0Q7UUFDcEQsb0RBQW9EO1FBQ3BELE1BQU0sT0FBTyxHQUFHLDRCQUE0QixDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQzdELElBQUksRUFBRSxDQUFDLEVBQUUsQ0FBQyxFQUFFLEdBQUcsS0FBSyxDQUFDO1FBQ3JCLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzdDLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRTdDLGlGQUFpRjtRQUNqRixJQUFJLE9BQU8sRUFBRTtZQUNYLENBQUMsSUFBSSxPQUFPLENBQUM7U0FDZDtRQUVELElBQUksT0FBTyxFQUFFO1lBQ1gsQ0FBQyxJQUFJLE9BQU8sQ0FBQztTQUNkO1FBRUQsc0VBQXNFO1FBQ3RFLElBQUksWUFBWSxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDekIsSUFBSSxhQUFhLEdBQUcsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQztRQUN2RCxJQUFJLFdBQVcsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO1FBQ3hCLElBQUksY0FBYyxHQUFHLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUM7UUFFMUQsNkNBQTZDO1FBQzdDLElBQUksWUFBWSxHQUFHLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLFlBQVksRUFBRSxhQUFhLENBQUMsQ0FBQztRQUN2RixJQUFJLGFBQWEsR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRSxXQUFXLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDekYsSUFBSSxXQUFXLEdBQUcsWUFBWSxHQUFHLGFBQWEsQ0FBQztRQUUvQyxPQUFPO1lBQ0wsV0FBVztZQUNYLDBCQUEwQixFQUFFLE9BQU8sQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLE1BQU0sS0FBSyxXQUFXO1lBQzFFLHdCQUF3QixFQUFFLGFBQWEsS0FBSyxPQUFPLENBQUMsTUFBTTtZQUMxRCwwQkFBMEIsRUFBRSxZQUFZLElBQUksT0FBTyxDQUFDLEtBQUs7U0FDMUQsQ0FBQztJQUNKLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNLLDZCQUE2QixDQUFDLEdBQWUsRUFBRSxLQUFZLEVBQUUsUUFBb0I7UUFDdkYsSUFBSSxJQUFJLENBQUMsc0JBQXNCLEVBQUU7WUFDL0IsTUFBTSxlQUFlLEdBQUcsUUFBUSxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQ2xELE1BQU0sY0FBYyxHQUFHLFFBQVEsQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQztZQUNoRCxNQUFNLFNBQVMsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN4RSxNQUFNLFFBQVEsR0FBRyxhQUFhLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUV0RSxNQUFNLFdBQVcsR0FBRyxHQUFHLENBQUMsd0JBQXdCLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxJQUFJLFNBQVMsSUFBSSxlQUFlLENBQUMsQ0FBQztZQUN4RyxNQUFNLGFBQWEsR0FBRyxHQUFHLENBQUMsMEJBQTBCLElBQUksQ0FBQyxRQUFRLElBQUksSUFBSSxJQUFJLFFBQVEsSUFBSSxjQUFjLENBQUMsQ0FBQztZQUV6RyxPQUFPLFdBQVcsSUFBSSxhQUFhLENBQUM7U0FDckM7UUFDRCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUM7SUFFRDs7Ozs7Ozs7OztPQVVHO0lBQ0ssb0JBQW9CLENBQzFCLEtBQVksRUFDWixjQUEwQixFQUMxQixjQUFzQztRQUV0QywwRkFBMEY7UUFDMUYsMEZBQTBGO1FBQzFGLGdHQUFnRztRQUNoRyxJQUFJLElBQUksQ0FBQyxtQkFBbUIsSUFBSSxJQUFJLENBQUMsZUFBZSxFQUFFO1lBQ3BELE9BQU87Z0JBQ0wsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLG1CQUFtQixDQUFDLENBQUM7Z0JBQ3ZDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxDQUFDO2FBQ3hDLENBQUM7U0FDSDtRQUVELG9EQUFvRDtRQUNwRCxvREFBb0Q7UUFDcEQsTUFBTSxPQUFPLEdBQUcsNEJBQTRCLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDN0QsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQztRQUVwQyxtRUFBbUU7UUFDbkUsOERBQThEO1FBQzlELE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxPQUFPLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDNUUsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMvRSxNQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEdBQUcsY0FBYyxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzdFLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksR0FBRyxjQUFjLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFaEYsbUZBQW1GO1FBQ25GLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztRQUNkLElBQUksS0FBSyxHQUFHLENBQUMsQ0FBQztRQUVkLDJGQUEyRjtRQUMzRix5RkFBeUY7UUFDekYsOEVBQThFO1FBQzlFLElBQUksT0FBTyxDQUFDLEtBQUssSUFBSSxRQUFRLENBQUMsS0FBSyxFQUFFO1lBQ25DLEtBQUssR0FBRyxZQUFZLElBQUksQ0FBQyxhQUFhLENBQUM7U0FDeEM7YUFBTTtZQUNMLEtBQUssR0FBRyxLQUFLLENBQUMsQ0FBQyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxJQUFJLEdBQUcsY0FBYyxDQUFDLElBQUksR0FBRyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7U0FDNUY7UUFFRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLElBQUksUUFBUSxDQUFDLE1BQU0sRUFBRTtZQUNyQyxLQUFLLEdBQUcsV0FBVyxJQUFJLENBQUMsY0FBYyxDQUFDO1NBQ3hDO2FBQU07WUFDTCxLQUFLLEdBQUcsS0FBSyxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsR0FBRyxHQUFHLGNBQWMsQ0FBQyxHQUFHLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQzFGO1FBRUQsSUFBSSxDQUFDLG1CQUFtQixHQUFHLEVBQUUsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsS0FBSyxFQUFFLENBQUM7UUFFbEQsT0FBTztZQUNMLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQyxHQUFHLEtBQUs7WUFDbEIsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLEdBQUcsS0FBSztTQUNuQixDQUFDO0lBQ0osQ0FBQztJQUVEOzs7O09BSUc7SUFDSyxjQUFjLENBQUMsUUFBMkIsRUFBRSxXQUFrQjtRQUNwRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDbkMsSUFBSSxDQUFDLHdCQUF3QixDQUFDLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNyRCxJQUFJLENBQUMscUJBQXFCLENBQUMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRWxELElBQUksUUFBUSxDQUFDLFVBQVUsRUFBRTtZQUN2QixJQUFJLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQzVDO1FBRUQsbUZBQW1GO1FBQ25GLElBQUksQ0FBQyxhQUFhLEdBQUcsUUFBUSxDQUFDO1FBRTlCLDhFQUE4RTtRQUM5RSw2RUFBNkU7UUFDN0UsMENBQTBDO1FBQzFDLElBQUksSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUU7WUFDMUMsTUFBTSx3QkFBd0IsR0FBRyxJQUFJLENBQUMsb0JBQW9CLEVBQUUsQ0FBQztZQUM3RCxNQUFNLFdBQVcsR0FBRyxJQUFJLDhCQUE4QixDQUFDLFFBQVEsRUFBRSx3QkFBd0IsQ0FBQyxDQUFDO1lBQzNGLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUM7U0FDekM7UUFFRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsS0FBSyxDQUFDO0lBQ2hDLENBQUM7SUFFRCw4RkFBOEY7SUFDdEYsbUJBQW1CLENBQUMsUUFBMkI7UUFDckQsSUFBSSxDQUFDLElBQUksQ0FBQyx3QkFBd0IsRUFBRTtZQUNsQyxPQUFPO1NBQ1I7UUFFRCxNQUFNLFFBQVEsR0FBNEIsSUFBSSxDQUFDLFlBQWEsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsd0JBQXdCLENBQUMsQ0FBQztRQUM3RyxJQUFJLE9BQW9DLENBQUM7UUFDekMsSUFBSSxPQUFPLEdBQWdDLFFBQVEsQ0FBQyxRQUFRLENBQUM7UUFFN0QsSUFBSSxRQUFRLENBQUMsUUFBUSxLQUFLLFFBQVEsRUFBRTtZQUNsQyxPQUFPLEdBQUcsUUFBUSxDQUFDO1NBQ3BCO2FBQU0sSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUU7WUFDeEIsT0FBTyxHQUFHLFFBQVEsQ0FBQyxRQUFRLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztTQUM1RDthQUFNO1lBQ0wsT0FBTyxHQUFHLFFBQVEsQ0FBQyxRQUFRLEtBQUssT0FBTyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztTQUM1RDtRQUVELEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ3hDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsZUFBZSxHQUFHLEdBQUcsT0FBTyxJQUFJLE9BQU8sRUFBRSxDQUFDO1NBQzdEO0lBQ0gsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0sseUJBQXlCLENBQUMsTUFBYSxFQUFFLFFBQTJCO1FBQzFFLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7UUFDcEMsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBQzVCLElBQUksTUFBYyxFQUFFLEdBQVcsRUFBRSxNQUFjLENBQUM7UUFFaEQsSUFBSSxRQUFRLENBQUMsUUFBUSxLQUFLLEtBQUssRUFBRTtZQUMvQiwrRUFBK0U7WUFDL0UsR0FBRyxHQUFHLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDZixNQUFNLEdBQUcsUUFBUSxDQUFDLE1BQU0sR0FBRyxHQUFHLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztTQUN2RDthQUFNLElBQUksUUFBUSxDQUFDLFFBQVEsS0FBSyxRQUFRLEVBQUU7WUFDekMseUZBQXlGO1lBQ3pGLHdGQUF3RjtZQUN4Riw4RUFBOEU7WUFDOUUsTUFBTSxHQUFHLFFBQVEsQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsZUFBZSxHQUFHLENBQUMsQ0FBQztZQUMvRCxNQUFNLEdBQUcsUUFBUSxDQUFDLE1BQU0sR0FBRyxNQUFNLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztTQUMxRDthQUFNO1lBQ0wscUZBQXFGO1lBQ3JGLHFGQUFxRjtZQUNyRixzRkFBc0Y7WUFDdEYsNkJBQTZCO1lBQzdCLE1BQU0sOEJBQThCLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxRQUFRLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFFckcsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE1BQU0sQ0FBQztZQUV4RCxNQUFNLEdBQUcsOEJBQThCLEdBQUcsQ0FBQyxDQUFDO1lBQzVDLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLDhCQUE4QixDQUFDO1lBRWhELElBQUksTUFBTSxHQUFHLGNBQWMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUU7Z0JBQzdFLEdBQUcsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLGNBQWMsR0FBRyxDQUFDLENBQUM7YUFDckM7U0FDRjtRQUVELHdFQUF3RTtRQUN4RSxNQUFNLDRCQUE0QixHQUNoQyxDQUFDLFFBQVEsQ0FBQyxRQUFRLEtBQUssT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxLQUFLLEtBQUssSUFBSSxLQUFLLENBQUMsQ0FBQztRQUV0RixzRUFBc0U7UUFDdEUsTUFBTSwyQkFBMkIsR0FDL0IsQ0FBQyxRQUFRLENBQUMsUUFBUSxLQUFLLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsS0FBSyxPQUFPLElBQUksS0FBSyxDQUFDLENBQUM7UUFFdEYsSUFBSSxLQUFhLEVBQUUsSUFBWSxFQUFFLEtBQWEsQ0FBQztRQUUvQyxJQUFJLDJCQUEyQixFQUFFO1lBQy9CLEtBQUssR0FBRyxRQUFRLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQztZQUN6RCxLQUFLLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsZUFBZSxDQUFDO1NBQ3pDO2FBQU0sSUFBSSw0QkFBNEIsRUFBRTtZQUN2QyxJQUFJLEdBQUcsTUFBTSxDQUFDLENBQUMsQ0FBQztZQUNoQixLQUFLLEdBQUcsUUFBUSxDQUFDLEtBQUssR0FBRyxNQUFNLENBQUMsQ0FBQyxDQUFDO1NBQ25DO2FBQU07WUFDTCxzRkFBc0Y7WUFDdEYscUZBQXFGO1lBQ3JGLHFGQUFxRjtZQUNyRiw4QkFBOEI7WUFDOUIsTUFBTSw4QkFBOEIsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxFQUFFLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNyRyxNQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDO1lBRXRELEtBQUssR0FBRyw4QkFBOEIsR0FBRyxDQUFDLENBQUM7WUFDM0MsSUFBSSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsOEJBQThCLENBQUM7WUFFakQsSUFBSSxLQUFLLEdBQUcsYUFBYSxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRTtnQkFDM0UsSUFBSSxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUcsYUFBYSxHQUFHLENBQUMsQ0FBQzthQUNyQztTQUNGO1FBRUQsT0FBTyxFQUFFLEdBQUcsRUFBRSxHQUFJLEVBQUUsSUFBSSxFQUFFLElBQUssRUFBRSxNQUFNLEVBQUUsTUFBTyxFQUFFLEtBQUssRUFBRSxLQUFNLEVBQUUsS0FBSyxFQUFFLE1BQU0sRUFBRSxDQUFDO0lBQ25GLENBQUM7SUFFRDs7Ozs7O09BTUc7SUFDSyxxQkFBcUIsQ0FBQyxNQUFhLEVBQUUsUUFBMkI7UUFDdEUsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDLHlCQUF5QixDQUFDLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztRQUV6RSwyRkFBMkY7UUFDM0YsNEJBQTRCO1FBQzVCLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxFQUFFO1lBQ2xELGVBQWUsQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1RixlQUFlLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxJQUFJLENBQUMsb0JBQW9CLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDMUY7UUFFRCxNQUFNLE1BQU0sR0FBRyxFQUF5QixDQUFDO1FBRXpDLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFLEVBQUU7WUFDNUIsTUFBTSxDQUFDLEdBQUcsR0FBRyxNQUFNLENBQUMsSUFBSSxHQUFHLEdBQUcsQ0FBQztZQUMvQixNQUFNLENBQUMsTUFBTSxHQUFHLE1BQU0sQ0FBQyxLQUFLLEdBQUcsTUFBTSxDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztZQUN2RSxNQUFNLENBQUMsS0FBSyxHQUFHLE1BQU0sQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDO1NBQ3ZDO2FBQU07WUFDTCxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxDQUFDLFNBQVMsQ0FBQztZQUN6RCxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQztZQUV2RCxNQUFNLENBQUMsTUFBTSxHQUFHLG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1RCxNQUFNLENBQUMsR0FBRyxHQUFHLG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQztZQUN0RCxNQUFNLENBQUMsTUFBTSxHQUFHLG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1RCxNQUFNLENBQUMsS0FBSyxHQUFHLG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUMxRCxNQUFNLENBQUMsSUFBSSxHQUFHLG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUN4RCxNQUFNLENBQUMsS0FBSyxHQUFHLG1CQUFtQixDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUUxRCxzREFBc0Q7WUFDdEQsSUFBSSxRQUFRLENBQUMsUUFBUSxLQUFLLFFBQVEsRUFBRTtnQkFDbEMsTUFBTSxDQUFDLFVBQVUsR0FBRyxRQUFRLENBQUM7YUFDOUI7aUJBQU07Z0JBQ0wsTUFBTSxDQUFDLFVBQVUsR0FBRyxRQUFRLENBQUMsUUFBUSxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUM7YUFDN0U7WUFFRCxJQUFJLFFBQVEsQ0FBQyxRQUFRLEtBQUssUUFBUSxFQUFFO2dCQUNsQyxNQUFNLENBQUMsY0FBYyxHQUFHLFFBQVEsQ0FBQzthQUNsQztpQkFBTTtnQkFDTCxNQUFNLENBQUMsY0FBYyxHQUFHLFFBQVEsQ0FBQyxRQUFRLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQzthQUNwRjtZQUVELElBQUksU0FBUyxFQUFFO2dCQUNiLE1BQU0sQ0FBQyxTQUFTLEdBQUcsbUJBQW1CLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDbkQ7WUFFRCxJQUFJLFFBQVEsRUFBRTtnQkFDWixNQUFNLENBQUMsUUFBUSxHQUFHLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQ2pEO1NBQ0Y7UUFFRCxJQUFJLENBQUMsb0JBQW9CLEdBQUcsZUFBZSxDQUFDO1FBRTVDLFlBQVksQ0FBQyxJQUFJLENBQUMsWUFBYSxDQUFDLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQztJQUNqRCxDQUFDO0lBRUQsd0ZBQXdGO0lBQ2hGLHVCQUF1QjtRQUM3QixZQUFZLENBQUMsSUFBSSxDQUFDLFlBQWEsQ0FBQyxLQUFLLEVBQUU7WUFDckMsR0FBRyxFQUFFLEdBQUc7WUFDUixJQUFJLEVBQUUsR0FBRztZQUNULEtBQUssRUFBRSxHQUFHO1lBQ1YsTUFBTSxFQUFFLEdBQUc7WUFDWCxNQUFNLEVBQUUsRUFBRTtZQUNWLEtBQUssRUFBRSxFQUFFO1lBQ1QsVUFBVSxFQUFFLEVBQUU7WUFDZCxjQUFjLEVBQUUsRUFBRTtTQUNJLENBQUMsQ0FBQztJQUM1QixDQUFDO0lBRUQsd0ZBQXdGO0lBQ2hGLDBCQUEwQjtRQUNoQyxZQUFZLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUU7WUFDN0IsR0FBRyxFQUFFLEVBQUU7WUFDUCxJQUFJLEVBQUUsRUFBRTtZQUNSLE1BQU0sRUFBRSxFQUFFO1lBQ1YsS0FBSyxFQUFFLEVBQUU7WUFDVCxRQUFRLEVBQUUsRUFBRTtZQUNaLFNBQVMsRUFBRSxFQUFFO1NBQ1MsQ0FBQyxDQUFDO0lBQzVCLENBQUM7SUFFRCxzREFBc0Q7SUFDOUMsd0JBQXdCLENBQUMsV0FBa0IsRUFBRSxRQUEyQjtRQUM5RSxNQUFNLE1BQU0sR0FBRyxFQUF5QixDQUFDO1FBQ3pDLE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDbEQsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUM7UUFDMUQsTUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUUsQ0FBQztRQUU1QyxJQUFJLGdCQUFnQixFQUFFO1lBQ3BCLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMseUJBQXlCLEVBQUUsQ0FBQztZQUN2RSxZQUFZLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLGNBQWMsQ0FBQyxDQUFDLENBQUM7WUFDcEYsWUFBWSxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxjQUFjLENBQUMsQ0FBQyxDQUFDO1NBQ3JGO2FBQU07WUFDTCxNQUFNLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztTQUM1QjtRQUVELDBGQUEwRjtRQUMxRiwwRkFBMEY7UUFDMUYseUZBQXlGO1FBQ3pGLHNGQUFzRjtRQUN0RiwwREFBMEQ7UUFDMUQsSUFBSSxlQUFlLEdBQUcsRUFBRSxDQUFDO1FBQ3pCLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBQzdDLElBQUksT0FBTyxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLEdBQUcsQ0FBQyxDQUFDO1FBRTdDLElBQUksT0FBTyxFQUFFO1lBQ1gsZUFBZSxJQUFJLGNBQWMsT0FBTyxNQUFNLENBQUM7U0FDaEQ7UUFFRCxJQUFJLE9BQU8sRUFBRTtZQUNYLGVBQWUsSUFBSSxjQUFjLE9BQU8sS0FBSyxDQUFDO1NBQy9DO1FBRUQsTUFBTSxDQUFDLFNBQVMsR0FBRyxlQUFlLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFMUMsNkZBQTZGO1FBQzdGLDJGQUEyRjtRQUMzRiw0RkFBNEY7UUFDNUYsMkZBQTJGO1FBQzNGLCtEQUErRDtRQUMvRCxJQUFJLE1BQU0sQ0FBQyxTQUFTLEVBQUU7WUFDcEIsSUFBSSxnQkFBZ0IsRUFBRTtnQkFDcEIsTUFBTSxDQUFDLFNBQVMsR0FBRyxtQkFBbUIsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDMUQ7aUJBQU0sSUFBSSxxQkFBcUIsRUFBRTtnQkFDaEMsTUFBTSxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUM7YUFDdkI7U0FDRjtRQUVELElBQUksTUFBTSxDQUFDLFFBQVEsRUFBRTtZQUNuQixJQUFJLGdCQUFnQixFQUFFO2dCQUNwQixNQUFNLENBQUMsUUFBUSxHQUFHLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUN4RDtpQkFBTSxJQUFJLHFCQUFxQixFQUFFO2dCQUNoQyxNQUFNLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQzthQUN0QjtTQUNGO1FBRUQsWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ3pDLENBQUM7SUFFRCxnR0FBZ0c7SUFDeEYsaUJBQWlCLENBQUMsUUFBMkIsRUFBRSxXQUFrQixFQUFFLGNBQXNDO1FBQy9HLDJEQUEyRDtRQUMzRCx5REFBeUQ7UUFDekQsSUFBSSxNQUFNLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxFQUFFLEVBQXlCLENBQUM7UUFDNUQsSUFBSSxZQUFZLEdBQUcsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBRW5GLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRTtZQUNsQixZQUFZLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLFlBQVksRUFBRSxJQUFJLENBQUMsWUFBWSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1NBQzNGO1FBRUQsdUZBQXVGO1FBQ3ZGLGdGQUFnRjtRQUNoRixJQUFJLFFBQVEsQ0FBQyxRQUFRLEtBQUssUUFBUSxFQUFFO1lBQ2xDLDZFQUE2RTtZQUM3RSx1REFBdUQ7WUFDdkQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFnQixDQUFDLFlBQVksQ0FBQztZQUNwRSxNQUFNLENBQUMsTUFBTSxHQUFHLEdBQUcsY0FBYyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7U0FDckY7YUFBTTtZQUNMLE1BQU0sQ0FBQyxHQUFHLEdBQUcsbUJBQW1CLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ2xEO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVELGdHQUFnRztJQUN4RixpQkFBaUIsQ0FBQyxRQUEyQixFQUFFLFdBQWtCLEVBQUUsY0FBc0M7UUFDL0csa0ZBQWtGO1FBQ2xGLGtDQUFrQztRQUNsQyxJQUFJLE1BQU0sR0FBRyxFQUFFLElBQUksRUFBRSxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBeUIsQ0FBQztRQUM1RCxJQUFJLFlBQVksR0FBRyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFFbkYsSUFBSSxJQUFJLENBQUMsU0FBUyxFQUFFO1lBQ2xCLFlBQVksR0FBRyxJQUFJLENBQUMsb0JBQW9CLENBQUMsWUFBWSxFQUFFLElBQUksQ0FBQyxZQUFZLEVBQUUsY0FBYyxDQUFDLENBQUM7U0FDM0Y7UUFFRCxnR0FBZ0c7UUFDaEcsMEZBQTBGO1FBQzFGLDJGQUEyRjtRQUMzRix5QkFBeUI7UUFDekIsSUFBSSx1QkFBeUMsQ0FBQztRQUU5QyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRTtZQUNqQix1QkFBdUIsR0FBRyxRQUFRLENBQUMsUUFBUSxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUM7U0FDMUU7YUFBTTtZQUNMLHVCQUF1QixHQUFHLFFBQVEsQ0FBQyxRQUFRLEtBQUssS0FBSyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQztTQUMxRTtRQUVELG9GQUFvRjtRQUNwRixpRUFBaUU7UUFDakUsSUFBSSx1QkFBdUIsS0FBSyxPQUFPLEVBQUU7WUFDdkMsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxlQUFnQixDQUFDLFdBQVcsQ0FBQztZQUNsRSxNQUFNLENBQUMsS0FBSyxHQUFHLEdBQUcsYUFBYSxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsR0FBRyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7U0FDbEY7YUFBTTtZQUNMLE1BQU0sQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1NBQ25EO1FBRUQsT0FBTyxNQUFNLENBQUM7SUFDaEIsQ0FBQztJQUVEOzs7T0FHRztJQUNLLG9CQUFvQjtRQUMxQiwrREFBK0Q7UUFDL0QsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLGNBQWMsRUFBRSxDQUFDO1FBQzNDLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMscUJBQXFCLEVBQUUsQ0FBQztRQUV6RCw0RkFBNEY7UUFDNUYsNEZBQTRGO1FBQzVGLDZCQUE2QjtRQUM3QixNQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQy9ELE9BQU8sVUFBVSxDQUFDLGFBQWEsRUFBRSxDQUFDLGFBQWEsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1FBQzFFLENBQUMsQ0FBQyxDQUFDO1FBRUgsT0FBTztZQUNMLGVBQWUsRUFBRSwyQkFBMkIsQ0FBQyxZQUFZLEVBQUUscUJBQXFCLENBQUM7WUFDakYsbUJBQW1CLEVBQUUsNEJBQTRCLENBQUMsWUFBWSxFQUFFLHFCQUFxQixDQUFDO1lBQ3RGLGdCQUFnQixFQUFFLDJCQUEyQixDQUFDLGFBQWEsRUFBRSxxQkFBcUIsQ0FBQztZQUNuRixvQkFBb0IsRUFBRSw0QkFBNEIsQ0FBQyxhQUFhLEVBQUUscUJBQXFCLENBQUM7U0FDekYsQ0FBQztJQUNKLENBQUM7SUFFRCxzRkFBc0Y7SUFDOUUsa0JBQWtCLENBQUMsTUFBYyxFQUFFLEdBQUcsU0FBbUI7UUFDL0QsT0FBTyxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsWUFBb0IsRUFBRSxlQUF1QixFQUFFLEVBQUU7WUFDeEUsT0FBTyxZQUFZLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxlQUFlLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDckQsQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0lBQ2IsQ0FBQztJQUVELHNFQUFzRTtJQUM5RCx3QkFBd0I7UUFDOUIsd0ZBQXdGO1FBQ3hGLDBGQUEwRjtRQUMxRiwyRkFBMkY7UUFDM0YsbUZBQW1GO1FBQ25GLHNFQUFzRTtRQUN0RSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLGVBQWdCLENBQUMsV0FBVyxDQUFDO1FBQzFELE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsZUFBZ0IsQ0FBQyxZQUFZLENBQUM7UUFDNUQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyx5QkFBeUIsRUFBRSxDQUFDO1FBRXZFLE9BQU87WUFDTCxHQUFHLEVBQUUsY0FBYyxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsZUFBZTtZQUM5QyxJQUFJLEVBQUUsY0FBYyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsZUFBZTtZQUNoRCxLQUFLLEVBQUUsY0FBYyxDQUFDLElBQUksR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLGVBQWU7WUFDekQsTUFBTSxFQUFFLGNBQWMsQ0FBQyxHQUFHLEdBQUcsTUFBTSxHQUFHLElBQUksQ0FBQyxlQUFlO1lBQzFELEtBQUssRUFBRSxLQUFLLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxlQUFlO1lBQ3ZDLE1BQU0sRUFBRSxNQUFNLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQyxlQUFlO1NBQzFDLENBQUM7SUFDSixDQUFDO0lBRUQsb0RBQW9EO0lBQzVDLE1BQU07UUFDWixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUMsWUFBWSxFQUFFLEtBQUssS0FBSyxDQUFDO0lBQ25ELENBQUM7SUFFRCx5RUFBeUU7SUFDakUsaUJBQWlCO1FBQ3ZCLE9BQU8sQ0FBQyxJQUFJLENBQUMsc0JBQXNCLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN4RCxDQUFDO0lBRUQsZ0VBQWdFO0lBQ3hELFVBQVUsQ0FBQyxRQUEyQixFQUFFLElBQWU7UUFDN0QsSUFBSSxJQUFJLEtBQUssR0FBRyxFQUFFO1lBQ2hCLDREQUE0RDtZQUM1RCw0REFBNEQ7WUFDNUQsT0FBTyxRQUFRLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQztTQUNwRTtRQUVELE9BQU8sUUFBUSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUM7SUFDckUsQ0FBQztJQUVELHFFQUFxRTtJQUM3RCxrQkFBa0I7UUFDeEIsSUFBSSxJQUFJLEVBQUU7WUFDUixJQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE1BQU0sRUFBRTtnQkFDcEMsTUFBTSxLQUFLLENBQUMsdUVBQXVFLENBQUMsQ0FBQzthQUN0RjtZQUVELDREQUE0RDtZQUM1RCxvREFBb0Q7WUFDcEQsSUFBSSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsRUFBRTtnQkFDdEMsMEJBQTBCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDcEQsd0JBQXdCLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztnQkFDbEQsMEJBQTBCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDdEQsd0JBQXdCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUN0RCxDQUFDLENBQUMsQ0FBQztTQUNKO0lBQ0gsQ0FBQztJQUVELDJFQUEyRTtJQUNuRSxnQkFBZ0IsQ0FBQyxVQUE2QjtRQUNwRCxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDZCxXQUFXLENBQUMsVUFBVSxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUN6QyxJQUFJLFFBQVEsS0FBSyxFQUFFLElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRTtvQkFDekUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQztvQkFDekMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2lCQUNwQztZQUNILENBQUMsQ0FBQyxDQUFDO1NBQ0o7SUFDSCxDQUFDO0lBRUQsd0ZBQXdGO0lBQ2hGLGtCQUFrQjtRQUN4QixJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDZCxJQUFJLENBQUMsb0JBQW9CLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO2dCQUMzQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDeEMsQ0FBQyxDQUFDLENBQUM7WUFDSCxJQUFJLENBQUMsb0JBQW9CLEdBQUcsRUFBRSxDQUFDO1NBQ2hDO0lBQ0gsQ0FBQztJQUVELGlEQUFpRDtJQUN6QyxjQUFjO1FBQ3BCLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUM7UUFFNUIsSUFBSSxNQUFNLFlBQVksVUFBVSxFQUFFO1lBQ2hDLE9BQU8sTUFBTSxDQUFDLGFBQWEsQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1NBQ3JEO1FBRUQsd0RBQXdEO1FBQ3hELElBQUksTUFBTSxZQUFZLE9BQU8sRUFBRTtZQUM3QixPQUFPLE1BQU0sQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1NBQ3ZDO1FBRUQsTUFBTSxLQUFLLEdBQUcsTUFBTSxDQUFDLEtBQUssSUFBSSxDQUFDLENBQUM7UUFDaEMsTUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUM7UUFFbEMsMEZBQTBGO1FBQzFGLE9BQU87WUFDTCxHQUFHLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDYixNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsR0FBRyxNQUFNO1lBQ3pCLElBQUksRUFBRSxNQUFNLENBQUMsQ0FBQztZQUNkLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUs7WUFDdkIsTUFBTTtZQUNOLEtBQUs7U0FDTixDQUFDO0lBQ0osQ0FBQztDQUNGO0FBZ0VELDBFQUEwRTtBQUMxRSxTQUFTLFlBQVksQ0FBQyxXQUFnQyxFQUFFLE1BQTJCO0lBQ2pGLEtBQUssSUFBSSxHQUFHLElBQUksTUFBTSxFQUFFO1FBQ3RCLElBQUksTUFBTSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUM5QixXQUFXLENBQUMsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1NBQ2hDO0tBQ0Y7SUFFRCxPQUFPLFdBQVcsQ0FBQztBQUNyQixDQUFDO0FBRUQ7OztHQUdHO0FBQ0gsU0FBUyxhQUFhLENBQUMsS0FBeUM7SUFDOUQsSUFBSSxPQUFPLEtBQUssS0FBSyxRQUFRLElBQUksS0FBSyxJQUFJLElBQUksRUFBRTtRQUM5QyxNQUFNLENBQUMsS0FBSyxFQUFFLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDbkQsT0FBTyxDQUFDLEtBQUssSUFBSSxLQUFLLEtBQUssSUFBSSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztLQUM1RDtJQUVELE9BQVEsS0FBYSxJQUFJLElBQUksQ0FBQztBQUNoQyxDQUFDO0FBRUQ7Ozs7O0dBS0c7QUFDSCxTQUFTLDRCQUE0QixDQUFDLFVBQXNCO0lBQzFELE9BQU87UUFDTCxHQUFHLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDO1FBQy9CLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUM7UUFDbkMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQztRQUNyQyxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDO1FBQ2pDLEtBQUssRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUM7UUFDbkMsTUFBTSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLE1BQU0sQ0FBQztLQUN0QyxDQUFDO0FBQ0osQ0FBQztBQUVELE1BQU0sQ0FBQyxNQUFNLGlDQUFpQyxHQUF3QjtJQUNwRSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUU7SUFDM0UsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFO0lBQzNFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRTtJQUN2RSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUU7Q0FDeEUsQ0FBQztBQUVGLE1BQU0sQ0FBQyxNQUFNLG9DQUFvQyxHQUF3QjtJQUN2RSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUU7SUFDdEUsRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFO0lBQzVFLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRTtJQUN0RSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUU7Q0FDN0UsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQGxpY2Vuc2VcbiAqIENvcHlyaWdodCBHb29nbGUgTExDIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXG4gKlxuICogVXNlIG9mIHRoaXMgc291cmNlIGNvZGUgaXMgZ292ZXJuZWQgYnkgYW4gTUlULXN0eWxlIGxpY2Vuc2UgdGhhdCBjYW4gYmVcbiAqIGZvdW5kIGluIHRoZSBMSUNFTlNFIGZpbGUgYXQgaHR0cHM6Ly9hbmd1bGFyLmlvL2xpY2Vuc2VcbiAqL1xuXG5pbXBvcnQgeyBjb2VyY2VBcnJheSwgY29lcmNlQ3NzUGl4ZWxWYWx1ZSB9IGZyb20gJ0Bhbmd1bGFyL2Nkay9jb2VyY2lvbic7XG5pbXBvcnQge1xuICBDb25uZWN0ZWRPdmVybGF5UG9zaXRpb25DaGFuZ2UsXG4gIENvbm5lY3Rpb25Qb3NpdGlvblBhaXIsXG4gIE92ZXJsYXlDb250YWluZXIsXG4gIE92ZXJsYXlSZWYsXG4gIFBvc2l0aW9uU3RyYXRlZ3ksXG4gIFNjcm9sbGluZ1Zpc2liaWxpdHksXG4gIHZhbGlkYXRlSG9yaXpvbnRhbFBvc2l0aW9uLFxuICB2YWxpZGF0ZVZlcnRpY2FsUG9zaXRpb24sXG59IGZyb20gJ0Bhbmd1bGFyL2Nkay9vdmVybGF5JztcbmltcG9ydCB7IFBsYXRmb3JtIH0gZnJvbSAnQGFuZ3VsYXIvY2RrL3BsYXRmb3JtJztcbmltcG9ydCB7IENka1Njcm9sbGFibGUsIFZpZXdwb3J0UnVsZXIsIFZpZXdwb3J0U2Nyb2xsUG9zaXRpb24gfSBmcm9tICdAYW5ndWxhci9jZGsvc2Nyb2xsaW5nJztcbmltcG9ydCB7IEVsZW1lbnRSZWYgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IE9ic2VydmFibGUsIFN1YmplY3QsIFN1YnNjcmlwdGlvbiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgaXNFbGVtZW50Q2xpcHBlZEJ5U2Nyb2xsaW5nLCBpc0VsZW1lbnRTY3JvbGxlZE91dHNpZGVWaWV3IH0gZnJvbSAnLi9zY3JvbGwtY2xpcC12MTcnO1xuXG4vLyBUT0RPOiByZWZhY3RvciBjbGlwcGluZyBkZXRlY3Rpb24gaW50byBhIHNlcGFyYXRlIHRoaW5nIChwYXJ0IG9mIHNjcm9sbGluZyBtb2R1bGUpXG4vLyBUT0RPOiBkb2Vzbid0IGhhbmRsZSBib3RoIGZsZXhpYmxlIHdpZHRoIGFuZCBoZWlnaHQgd2hlbiBpdCBoYXMgdG8gc2Nyb2xsIGFsb25nIGJvdGggYXhpcy5cblxuLyoqIENsYXNzIHRvIGJlIGFkZGVkIHRvIHRoZSBvdmVybGF5IGJvdW5kaW5nIGJveC4gKi9cbmNvbnN0IGJvdW5kaW5nQm94Q2xhc3MgPSAnY2RrLW92ZXJsYXktY29ubmVjdGVkLXBvc2l0aW9uLWJvdW5kaW5nLWJveCc7XG5cbi8qKiBSZWdleCB1c2VkIHRvIHNwbGl0IGEgc3RyaW5nIG9uIGl0cyBDU1MgdW5pdHMuICovXG5jb25zdCBjc3NVbml0UGF0dGVybiA9IC8oW0EtWmEteiVdKykkLztcblxuLyoqIFBvc3NpYmxlIHZhbHVlcyB0aGF0IGNhbiBiZSBzZXQgYXMgdGhlIG9yaWdpbiBvZiBhIEZsZXhpYmxlQ29ubmVjdGVkUG9zaXRpb25TdHJhdGVneS4gKi9cbmV4cG9ydCB0eXBlIEZsZXhpYmxlQ29ubmVjdGVkUG9zaXRpb25TdHJhdGVneU9yaWdpbiA9XG4gIHwgRWxlbWVudFJlZlxuICB8IEVsZW1lbnRcbiAgfCAoUG9pbnQgJiB7XG4gICAgICB3aWR0aD86IG51bWJlcjtcbiAgICAgIGhlaWdodD86IG51bWJlcjtcbiAgICB9KTtcblxuLyoqIEVxdWl2YWxlbnQgb2YgYERPTVJlY3RgIHdpdGhvdXQgc29tZSBvZiB0aGUgcHJvcGVydGllcyB3ZSBkb24ndCBjYXJlIGFib3V0LiAqL1xudHlwZSBEaW1lbnNpb25zID0gT21pdDxET01SZWN0LCAneCcgfCAneScgfCAndG9KU09OJz47XG5cbi8qKlxuICogQSBzdHJhdGVneSBmb3IgcG9zaXRpb25pbmcgb3ZlcmxheXMuIFVzaW5nIHRoaXMgc3RyYXRlZ3ksIGFuIG92ZXJsYXkgaXMgZ2l2ZW4gYW5cbiAqIGltcGxpY2l0IHBvc2l0aW9uIHJlbGF0aXZlIHNvbWUgb3JpZ2luIGVsZW1lbnQuIFRoZSByZWxhdGl2ZSBwb3NpdGlvbiBpcyBkZWZpbmVkIGluIHRlcm1zIG9mXG4gKiBhIHBvaW50IG9uIHRoZSBvcmlnaW4gZWxlbWVudCB0aGF0IGlzIGNvbm5lY3RlZCB0byBhIHBvaW50IG9uIHRoZSBvdmVybGF5IGVsZW1lbnQuIEZvciBleGFtcGxlLFxuICogYSBiYXNpYyBkcm9wZG93biBpcyBjb25uZWN0aW5nIHRoZSBib3R0b20tbGVmdCBjb3JuZXIgb2YgdGhlIG9yaWdpbiB0byB0aGUgdG9wLWxlZnQgY29ybmVyXG4gKiBvZiB0aGUgb3ZlcmxheS5cbiAqL1xuZXhwb3J0IGNsYXNzIEZsZXhpYmxlQ29ubmVjdGVkUG9zaXRpb25TdHJhdGVneTE3IGltcGxlbWVudHMgUG9zaXRpb25TdHJhdGVneSB7XG4gIC8qKiBUaGUgb3ZlcmxheSB0byB3aGljaCB0aGlzIHN0cmF0ZWd5IGlzIGF0dGFjaGVkLiAqL1xuICBwcml2YXRlIF9vdmVybGF5UmVmOiBPdmVybGF5UmVmO1xuXG4gIC8qKiBXaGV0aGVyIHdlJ3JlIHBlcmZvcm1pbmcgdGhlIHZlcnkgZmlyc3QgcG9zaXRpb25pbmcgb2YgdGhlIG92ZXJsYXkuICovXG4gIHByaXZhdGUgX2lzSW5pdGlhbFJlbmRlcjogYm9vbGVhbjtcblxuICAvKiogTGFzdCBzaXplIHVzZWQgZm9yIHRoZSBib3VuZGluZyBib3guIFVzZWQgdG8gYXZvaWQgcmVzaXppbmcgdGhlIG92ZXJsYXkgYWZ0ZXIgb3Blbi4gKi9cbiAgcHJpdmF0ZSBfbGFzdEJvdW5kaW5nQm94U2l6ZSA9IHsgd2lkdGg6IDAsIGhlaWdodDogMCB9O1xuXG4gIC8qKiBXaGV0aGVyIHRoZSBvdmVybGF5IHdhcyBwdXNoZWQgaW4gYSBwcmV2aW91cyBwb3NpdGlvbmluZy4gKi9cbiAgcHJpdmF0ZSBfaXNQdXNoZWQgPSBmYWxzZTtcblxuICAvKiogV2hldGhlciB0aGUgb3ZlcmxheSBjYW4gYmUgcHVzaGVkIG9uLXNjcmVlbiBvbiB0aGUgaW5pdGlhbCBvcGVuLiAqL1xuICBwcml2YXRlIF9jYW5QdXNoID0gdHJ1ZTtcblxuICAvKiogV2hldGhlciB0aGUgb3ZlcmxheSBjYW4gZ3JvdyB2aWEgZmxleGlibGUgd2lkdGgvaGVpZ2h0IGFmdGVyIHRoZSBpbml0aWFsIG9wZW4uICovXG4gIHByaXZhdGUgX2dyb3dBZnRlck9wZW4gPSBmYWxzZTtcblxuICAvKiogV2hldGhlciB0aGUgb3ZlcmxheSdzIHdpZHRoIGFuZCBoZWlnaHQgY2FuIGJlIGNvbnN0cmFpbmVkIHRvIGZpdCB3aXRoaW4gdGhlIHZpZXdwb3J0LiAqL1xuICBwcml2YXRlIF9oYXNGbGV4aWJsZURpbWVuc2lvbnMgPSB0cnVlO1xuXG4gIC8qKiBXaGV0aGVyIHRoZSBvdmVybGF5IHBvc2l0aW9uIGlzIGxvY2tlZC4gKi9cbiAgcHJpdmF0ZSBfcG9zaXRpb25Mb2NrZWQgPSBmYWxzZTtcblxuICAvKiogQ2FjaGVkIG9yaWdpbiBkaW1lbnNpb25zICovXG4gIHByaXZhdGUgX29yaWdpblJlY3Q6IERpbWVuc2lvbnM7XG5cbiAgLyoqIENhY2hlZCBvdmVybGF5IGRpbWVuc2lvbnMgKi9cbiAgcHJpdmF0ZSBfb3ZlcmxheVJlY3Q6IERpbWVuc2lvbnM7XG5cbiAgLyoqIENhY2hlZCB2aWV3cG9ydCBkaW1lbnNpb25zICovXG4gIHByaXZhdGUgX3ZpZXdwb3J0UmVjdDogRGltZW5zaW9ucztcblxuICAvKiogQ2FjaGVkIGNvbnRhaW5lciBkaW1lbnNpb25zICovXG4gIHByaXZhdGUgX2NvbnRhaW5lclJlY3Q6IERpbWVuc2lvbnM7XG5cbiAgLyoqIEFtb3VudCBvZiBzcGFjZSB0aGF0IG11c3QgYmUgbWFpbnRhaW5lZCBiZXR3ZWVuIHRoZSBvdmVybGF5IGFuZCB0aGUgZWRnZSBvZiB0aGUgdmlld3BvcnQuICovXG4gIHByaXZhdGUgX3ZpZXdwb3J0TWFyZ2luID0gMDtcblxuICAvKiogVGhlIFNjcm9sbGFibGUgY29udGFpbmVycyB1c2VkIHRvIGNoZWNrIHNjcm9sbGFibGUgdmlldyBwcm9wZXJ0aWVzIG9uIHBvc2l0aW9uIGNoYW5nZS4gKi9cbiAgcHJpdmF0ZSBfc2Nyb2xsYWJsZXM6IENka1Njcm9sbGFibGVbXSA9IFtdO1xuXG4gIC8qKiBPcmRlcmVkIGxpc3Qgb2YgcHJlZmVycmVkIHBvc2l0aW9ucywgZnJvbSBtb3N0IHRvIGxlYXN0IGRlc2lyYWJsZS4gKi9cbiAgX3ByZWZlcnJlZFBvc2l0aW9uczogQ29ubmVjdGlvblBvc2l0aW9uUGFpcltdID0gW107XG5cbiAgLyoqIFRoZSBvcmlnaW4gZWxlbWVudCBhZ2FpbnN0IHdoaWNoIHRoZSBvdmVybGF5IHdpbGwgYmUgcG9zaXRpb25lZC4gKi9cbiAgX29yaWdpbjogRmxleGlibGVDb25uZWN0ZWRQb3NpdGlvblN0cmF0ZWd5T3JpZ2luO1xuXG4gIC8qKiBUaGUgb3ZlcmxheSBwYW5lIGVsZW1lbnQuICovXG4gIHByaXZhdGUgX3BhbmU6IEhUTUxFbGVtZW50O1xuXG4gIC8qKiBXaGV0aGVyIHRoZSBzdHJhdGVneSBoYXMgYmVlbiBkaXNwb3NlZCBvZiBhbHJlYWR5LiAqL1xuICBwcml2YXRlIF9pc0Rpc3Bvc2VkOiBib29sZWFuO1xuXG4gIC8qKlxuICAgKiBQYXJlbnQgZWxlbWVudCBmb3IgdGhlIG92ZXJsYXkgcGFuZWwgdXNlZCB0byBjb25zdHJhaW4gdGhlIG92ZXJsYXkgcGFuZWwncyBzaXplIHRvIGZpdFxuICAgKiB3aXRoaW4gdGhlIHZpZXdwb3J0LlxuICAgKi9cbiAgcHJpdmF0ZSBfYm91bmRpbmdCb3g6IEhUTUxFbGVtZW50IHwgbnVsbDtcblxuICAvKiogVGhlIGxhc3QgcG9zaXRpb24gdG8gaGF2ZSBiZWVuIGNhbGN1bGF0ZWQgYXMgdGhlIGJlc3QgZml0IHBvc2l0aW9uLiAqL1xuICBwcml2YXRlIF9sYXN0UG9zaXRpb246IENvbm5lY3RlZFBvc2l0aW9uIHwgbnVsbDtcblxuICAvKiogU3ViamVjdCB0aGF0IGVtaXRzIHdoZW5ldmVyIHRoZSBwb3NpdGlvbiBjaGFuZ2VzLiAqL1xuICBwcml2YXRlIHJlYWRvbmx5IF9wb3NpdGlvbkNoYW5nZXMgPSBuZXcgU3ViamVjdDxDb25uZWN0ZWRPdmVybGF5UG9zaXRpb25DaGFuZ2U+KCk7XG5cbiAgLyoqIFN1YnNjcmlwdGlvbiB0byB2aWV3cG9ydCBzaXplIGNoYW5nZXMuICovXG4gIHByaXZhdGUgX3Jlc2l6ZVN1YnNjcmlwdGlvbiA9IFN1YnNjcmlwdGlvbi5FTVBUWTtcblxuICAvKiogRGVmYXVsdCBvZmZzZXQgZm9yIHRoZSBvdmVybGF5IGFsb25nIHRoZSB4IGF4aXMuICovXG4gIHByaXZhdGUgX29mZnNldFggPSAwO1xuXG4gIC8qKiBEZWZhdWx0IG9mZnNldCBmb3IgdGhlIG92ZXJsYXkgYWxvbmcgdGhlIHkgYXhpcy4gKi9cbiAgcHJpdmF0ZSBfb2Zmc2V0WSA9IDA7XG5cbiAgLyoqIFNlbGVjdG9yIHRvIGJlIHVzZWQgd2hlbiBmaW5kaW5nIHRoZSBlbGVtZW50cyBvbiB3aGljaCB0byBzZXQgdGhlIHRyYW5zZm9ybSBvcmlnaW4uICovXG4gIHByaXZhdGUgX3RyYW5zZm9ybU9yaWdpblNlbGVjdG9yOiBzdHJpbmc7XG5cbiAgLyoqIEtlZXBzIHRyYWNrIG9mIHRoZSBDU1MgY2xhc3NlcyB0aGF0IHRoZSBwb3NpdGlvbiBzdHJhdGVneSBoYXMgYXBwbGllZCBvbiB0aGUgb3ZlcmxheSBwYW5lbC4gKi9cbiAgcHJpdmF0ZSBfYXBwbGllZFBhbmVsQ2xhc3Nlczogc3RyaW5nW10gPSBbXTtcblxuICAvKiogQW1vdW50IGJ5IHdoaWNoIHRoZSBvdmVybGF5IHdhcyBwdXNoZWQgaW4gZWFjaCBheGlzIGR1cmluZyB0aGUgbGFzdCB0aW1lIGl0IHdhcyBwb3NpdGlvbmVkLiAqL1xuICBwcml2YXRlIF9wcmV2aW91c1B1c2hBbW91bnQ6IHsgeDogbnVtYmVyOyB5OiBudW1iZXIgfSB8IG51bGw7XG5cbiAgLyoqIE9ic2VydmFibGUgc2VxdWVuY2Ugb2YgcG9zaXRpb24gY2hhbmdlcy4gKi9cbiAgcG9zaXRpb25DaGFuZ2VzOiBPYnNlcnZhYmxlPENvbm5lY3RlZE92ZXJsYXlQb3NpdGlvbkNoYW5nZT4gPSB0aGlzLl9wb3NpdGlvbkNoYW5nZXM7XG5cbiAgLyoqIE9yZGVyZWQgbGlzdCBvZiBwcmVmZXJyZWQgcG9zaXRpb25zLCBmcm9tIG1vc3QgdG8gbGVhc3QgZGVzaXJhYmxlLiAqL1xuICBnZXQgcG9zaXRpb25zKCk6IENvbm5lY3Rpb25Qb3NpdGlvblBhaXJbXSB7XG4gICAgcmV0dXJuIHRoaXMuX3ByZWZlcnJlZFBvc2l0aW9ucztcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIGNvbm5lY3RlZFRvOiBGbGV4aWJsZUNvbm5lY3RlZFBvc2l0aW9uU3RyYXRlZ3lPcmlnaW4sXG4gICAgcHJpdmF0ZSBfdmlld3BvcnRSdWxlcjogVmlld3BvcnRSdWxlcixcbiAgICBwcml2YXRlIF9kb2N1bWVudDogRG9jdW1lbnQsXG4gICAgcHJpdmF0ZSBfcGxhdGZvcm06IFBsYXRmb3JtLFxuICAgIHByaXZhdGUgX292ZXJsYXlDb250YWluZXI6IE92ZXJsYXlDb250YWluZXIsXG4gICkge1xuICAgIHRoaXMuc2V0T3JpZ2luKGNvbm5lY3RlZFRvKTtcbiAgfVxuXG4gIC8qKiBBdHRhY2hlcyB0aGlzIHBvc2l0aW9uIHN0cmF0ZWd5IHRvIGFuIG92ZXJsYXkuICovXG4gIGF0dGFjaChvdmVybGF5UmVmOiBPdmVybGF5UmVmKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX292ZXJsYXlSZWYgJiYgb3ZlcmxheVJlZiAhPT0gdGhpcy5fb3ZlcmxheVJlZikge1xuICAgICAgdGhyb3cgRXJyb3IoJ1RoaXMgcG9zaXRpb24gc3RyYXRlZ3kgaXMgYWxyZWFkeSBhdHRhY2hlZCB0byBhbiBvdmVybGF5Jyk7XG4gICAgfVxuXG4gICAgdGhpcy5fdmFsaWRhdGVQb3NpdGlvbnMoKTtcblxuICAgIG92ZXJsYXlSZWYuaG9zdEVsZW1lbnQuY2xhc3NMaXN0LmFkZChib3VuZGluZ0JveENsYXNzKTtcblxuICAgIHRoaXMuX292ZXJsYXlSZWYgPSBvdmVybGF5UmVmO1xuICAgIHRoaXMuX2JvdW5kaW5nQm94ID0gb3ZlcmxheVJlZi5ob3N0RWxlbWVudDtcbiAgICB0aGlzLl9wYW5lID0gb3ZlcmxheVJlZi5vdmVybGF5RWxlbWVudDtcbiAgICB0aGlzLl9pc0Rpc3Bvc2VkID0gZmFsc2U7XG4gICAgdGhpcy5faXNJbml0aWFsUmVuZGVyID0gdHJ1ZTtcbiAgICB0aGlzLl9sYXN0UG9zaXRpb24gPSBudWxsO1xuICAgIHRoaXMuX3Jlc2l6ZVN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xuICAgIHRoaXMuX3Jlc2l6ZVN1YnNjcmlwdGlvbiA9IHRoaXMuX3ZpZXdwb3J0UnVsZXIuY2hhbmdlKCkuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgIC8vIFdoZW4gdGhlIHdpbmRvdyBpcyByZXNpemVkLCB3ZSB3YW50IHRvIHRyaWdnZXIgdGhlIG5leHQgcmVwb3NpdGlvbiBhcyBpZiBpdFxuICAgICAgLy8gd2FzIGFuIGluaXRpYWwgcmVuZGVyLCBpbiBvcmRlciBmb3IgdGhlIHN0cmF0ZWd5IHRvIHBpY2sgYSBuZXcgb3B0aW1hbCBwb3NpdGlvbixcbiAgICAgIC8vIG90aGVyd2lzZSBwb3NpdGlvbiBsb2NraW5nIHdpbGwgY2F1c2UgaXQgdG8gc3RheSBhdCB0aGUgb2xkIG9uZS5cbiAgICAgIHRoaXMuX2lzSW5pdGlhbFJlbmRlciA9IHRydWU7XG4gICAgICB0aGlzLmFwcGx5KCk7XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgcG9zaXRpb24gb2YgdGhlIG92ZXJsYXkgZWxlbWVudCwgdXNpbmcgd2hpY2hldmVyIHByZWZlcnJlZCBwb3NpdGlvbiByZWxhdGl2ZVxuICAgKiB0byB0aGUgb3JpZ2luIGJlc3QgZml0cyBvbi1zY3JlZW4uXG4gICAqXG4gICAqIFRoZSBzZWxlY3Rpb24gb2YgYSBwb3NpdGlvbiBnb2VzIGFzIGZvbGxvd3M6XG4gICAqICAtIElmIGFueSBwb3NpdGlvbnMgZml0IGNvbXBsZXRlbHkgd2l0aGluIHRoZSB2aWV3cG9ydCBhcy1pcyxcbiAgICogICAgICBjaG9vc2UgdGhlIGZpcnN0IHBvc2l0aW9uIHRoYXQgZG9lcyBzby5cbiAgICogIC0gSWYgZmxleGlibGUgZGltZW5zaW9ucyBhcmUgZW5hYmxlZCBhbmQgYXQgbGVhc3Qgb25lIHNhdGlzZmllcyB0aGUgZ2l2ZW4gbWluaW11bSB3aWR0aC9oZWlnaHQsXG4gICAqICAgICAgY2hvb3NlIHRoZSBwb3NpdGlvbiB3aXRoIHRoZSBncmVhdGVzdCBhdmFpbGFibGUgc2l6ZSBtb2RpZmllZCBieSB0aGUgcG9zaXRpb25zJyB3ZWlnaHQuXG4gICAqICAtIElmIHB1c2hpbmcgaXMgZW5hYmxlZCwgdGFrZSB0aGUgcG9zaXRpb24gdGhhdCB3ZW50IG9mZi1zY3JlZW4gdGhlIGxlYXN0IGFuZCBwdXNoIGl0XG4gICAqICAgICAgb24tc2NyZWVuLlxuICAgKiAgLSBJZiBub25lIG9mIHRoZSBwcmV2aW91cyBjcml0ZXJpYSB3ZXJlIG1ldCwgdXNlIHRoZSBwb3NpdGlvbiB0aGF0IGdvZXMgb2ZmLXNjcmVlbiB0aGUgbGVhc3QuXG4gICAqIEBkb2NzLXByaXZhdGVcbiAgICovXG4gIGFwcGx5KCk6IHZvaWQge1xuICAgIC8vIFdlIHNob3VsZG4ndCBkbyBhbnl0aGluZyBpZiB0aGUgc3RyYXRlZ3kgd2FzIGRpc3Bvc2VkIG9yIHdlJ3JlIG9uIHRoZSBzZXJ2ZXIuXG4gICAgaWYgKHRoaXMuX2lzRGlzcG9zZWQgfHwgIXRoaXMuX3BsYXRmb3JtLmlzQnJvd3Nlcikge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIElmIHRoZSBwb3NpdGlvbiBoYXMgYmVlbiBhcHBsaWVkIGFscmVhZHkgKGUuZy4gd2hlbiB0aGUgb3ZlcmxheSB3YXMgb3BlbmVkKSBhbmQgdGhlXG4gICAgLy8gY29uc3VtZXIgb3B0ZWQgaW50byBsb2NraW5nIGluIHRoZSBwb3NpdGlvbiwgcmUtdXNlIHRoZSBvbGQgcG9zaXRpb24sIGluIG9yZGVyIHRvXG4gICAgLy8gcHJldmVudCB0aGUgb3ZlcmxheSBmcm9tIGp1bXBpbmcgYXJvdW5kLlxuICAgIGlmICghdGhpcy5faXNJbml0aWFsUmVuZGVyICYmIHRoaXMuX3Bvc2l0aW9uTG9ja2VkICYmIHRoaXMuX2xhc3RQb3NpdGlvbikge1xuICAgICAgdGhpcy5yZWFwcGx5TGFzdFBvc2l0aW9uKCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgdGhpcy5fY2xlYXJQYW5lbENsYXNzZXMoKTtcbiAgICB0aGlzLl9yZXNldE92ZXJsYXlFbGVtZW50U3R5bGVzKCk7XG4gICAgdGhpcy5fcmVzZXRCb3VuZGluZ0JveFN0eWxlcygpO1xuXG4gICAgLy8gV2UgbmVlZCB0aGUgYm91bmRpbmcgcmVjdHMgZm9yIHRoZSBvcmlnaW4sIHRoZSBvdmVybGF5IGFuZCB0aGUgY29udGFpbmVyIHRvIGRldGVybWluZSBob3cgdG8gcG9zaXRpb25cbiAgICAvLyB0aGUgb3ZlcmxheSByZWxhdGl2ZSB0byB0aGUgb3JpZ2luLlxuICAgIC8vIFdlIHVzZSB0aGUgdmlld3BvcnQgcmVjdCB0byBkZXRlcm1pbmUgd2hldGhlciBhIHBvc2l0aW9uIHdvdWxkIGdvIG9mZi1zY3JlZW4uXG4gICAgdGhpcy5fdmlld3BvcnRSZWN0ID0gdGhpcy5fZ2V0TmFycm93ZWRWaWV3cG9ydFJlY3QoKTtcbiAgICB0aGlzLl9vcmlnaW5SZWN0ID0gdGhpcy5fZ2V0T3JpZ2luUmVjdCgpO1xuICAgIHRoaXMuX292ZXJsYXlSZWN0ID0gdGhpcy5fcGFuZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB0aGlzLl9jb250YWluZXJSZWN0ID0gdGhpcy5fb3ZlcmxheUNvbnRhaW5lci5nZXRDb250YWluZXJFbGVtZW50KCkuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICBjb25zdCBvcmlnaW5SZWN0ID0gdGhpcy5fb3JpZ2luUmVjdDtcbiAgICBjb25zdCBvdmVybGF5UmVjdCA9IHRoaXMuX292ZXJsYXlSZWN0O1xuICAgIGNvbnN0IHZpZXdwb3J0UmVjdCA9IHRoaXMuX3ZpZXdwb3J0UmVjdDtcbiAgICBjb25zdCBjb250YWluZXJSZWN0ID0gdGhpcy5fY29udGFpbmVyUmVjdDtcblxuICAgIC8vIFBvc2l0aW9ucyB3aGVyZSB0aGUgb3ZlcmxheSB3aWxsIGZpdCB3aXRoIGZsZXhpYmxlIGRpbWVuc2lvbnMuXG4gICAgY29uc3QgZmxleGlibGVGaXRzOiBGbGV4aWJsZUZpdFtdID0gW107XG5cbiAgICAvLyBGYWxsYmFjayBpZiBub25lIG9mIHRoZSBwcmVmZXJyZWQgcG9zaXRpb25zIGZpdCB3aXRoaW4gdGhlIHZpZXdwb3J0LlxuICAgIGxldCBmYWxsYmFjazogRmFsbGJhY2tQb3NpdGlvbiB8IHVuZGVmaW5lZDtcblxuICAgIC8vIEdvIHRocm91Z2ggZWFjaCBvZiB0aGUgcHJlZmVycmVkIHBvc2l0aW9ucyBsb29raW5nIGZvciBhIGdvb2QgZml0LlxuICAgIC8vIElmIGEgZ29vZCBmaXQgaXMgZm91bmQsIGl0IHdpbGwgYmUgYXBwbGllZCBpbW1lZGlhdGVseS5cbiAgICBmb3IgKGxldCBwb3Mgb2YgdGhpcy5fcHJlZmVycmVkUG9zaXRpb25zKSB7XG4gICAgICAvLyBHZXQgdGhlIGV4YWN0ICh4LCB5KSBjb29yZGluYXRlIGZvciB0aGUgcG9pbnQtb2Ytb3JpZ2luIG9uIHRoZSBvcmlnaW4gZWxlbWVudC5cbiAgICAgIGxldCBvcmlnaW5Qb2ludCA9IHRoaXMuX2dldE9yaWdpblBvaW50KG9yaWdpblJlY3QsIGNvbnRhaW5lclJlY3QsIHBvcyk7XG5cbiAgICAgIC8vIEZyb20gdGhhdCBwb2ludC1vZi1vcmlnaW4sIGdldCB0aGUgZXhhY3QgKHgsIHkpIGNvb3JkaW5hdGUgZm9yIHRoZSB0b3AtbGVmdCBjb3JuZXIgb2YgdGhlXG4gICAgICAvLyBvdmVybGF5IGluIHRoaXMgcG9zaXRpb24uIFdlIHVzZSB0aGUgdG9wLWxlZnQgY29ybmVyIGZvciBjYWxjdWxhdGlvbnMgYW5kIGxhdGVyIHRyYW5zbGF0ZVxuICAgICAgLy8gdGhpcyBpbnRvIGFuIGFwcHJvcHJpYXRlICh0b3AsIGxlZnQsIGJvdHRvbSwgcmlnaHQpIHN0eWxlLlxuICAgICAgbGV0IG92ZXJsYXlQb2ludCA9IHRoaXMuX2dldE92ZXJsYXlQb2ludChvcmlnaW5Qb2ludCwgb3ZlcmxheVJlY3QsIHBvcyk7XG5cbiAgICAgIC8vIENhbGN1bGF0ZSBob3cgd2VsbCB0aGUgb3ZlcmxheSB3b3VsZCBmaXQgaW50byB0aGUgdmlld3BvcnQgd2l0aCB0aGlzIHBvaW50LlxuICAgICAgbGV0IG92ZXJsYXlGaXQgPSB0aGlzLl9nZXRPdmVybGF5Rml0KG92ZXJsYXlQb2ludCwgb3ZlcmxheVJlY3QsIHZpZXdwb3J0UmVjdCwgcG9zKTtcblxuICAgICAgLy8gSWYgdGhlIG92ZXJsYXksIHdpdGhvdXQgYW55IGZ1cnRoZXIgd29yaywgZml0cyBpbnRvIHRoZSB2aWV3cG9ydCwgdXNlIHRoaXMgcG9zaXRpb24uXG4gICAgICBpZiAob3ZlcmxheUZpdC5pc0NvbXBsZXRlbHlXaXRoaW5WaWV3cG9ydCkge1xuICAgICAgICB0aGlzLl9pc1B1c2hlZCA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hcHBseVBvc2l0aW9uKHBvcywgb3JpZ2luUG9pbnQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIC8vIElmIHRoZSBvdmVybGF5IGhhcyBmbGV4aWJsZSBkaW1lbnNpb25zLCB3ZSBjYW4gdXNlIHRoaXMgcG9zaXRpb25cbiAgICAgIC8vIHNvIGxvbmcgYXMgdGhlcmUncyBlbm91Z2ggc3BhY2UgZm9yIHRoZSBtaW5pbXVtIGRpbWVuc2lvbnMuXG4gICAgICBpZiAodGhpcy5fY2FuRml0V2l0aEZsZXhpYmxlRGltZW5zaW9ucyhvdmVybGF5Rml0LCBvdmVybGF5UG9pbnQsIHZpZXdwb3J0UmVjdCkpIHtcbiAgICAgICAgLy8gU2F2ZSBwb3NpdGlvbnMgd2hlcmUgdGhlIG92ZXJsYXkgd2lsbCBmaXQgd2l0aCBmbGV4aWJsZSBkaW1lbnNpb25zLiBXZSB3aWxsIHVzZSB0aGVzZVxuICAgICAgICAvLyBpZiBub25lIG9mIHRoZSBwb3NpdGlvbnMgZml0ICp3aXRob3V0KiBmbGV4aWJsZSBkaW1lbnNpb25zLlxuICAgICAgICBmbGV4aWJsZUZpdHMucHVzaCh7XG4gICAgICAgICAgcG9zaXRpb246IHBvcyxcbiAgICAgICAgICBvcmlnaW46IG9yaWdpblBvaW50LFxuICAgICAgICAgIG92ZXJsYXlSZWN0LFxuICAgICAgICAgIGJvdW5kaW5nQm94UmVjdDogdGhpcy5fY2FsY3VsYXRlQm91bmRpbmdCb3hSZWN0KG9yaWdpblBvaW50LCBwb3MpLFxuICAgICAgICB9KTtcblxuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cblxuICAgICAgLy8gSWYgdGhlIGN1cnJlbnQgcHJlZmVycmVkIHBvc2l0aW9uIGRvZXMgbm90IGZpdCBvbiB0aGUgc2NyZWVuLCByZW1lbWJlciB0aGUgcG9zaXRpb25cbiAgICAgIC8vIGlmIGl0IGhhcyBtb3JlIHZpc2libGUgYXJlYSBvbi1zY3JlZW4gdGhhbiB3ZSd2ZSBzZWVuIGFuZCBtb3ZlIG9udG8gdGhlIG5leHQgcHJlZmVycmVkXG4gICAgICAvLyBwb3NpdGlvbi5cbiAgICAgIGlmICghZmFsbGJhY2sgfHwgZmFsbGJhY2sub3ZlcmxheUZpdC52aXNpYmxlQXJlYSA8IG92ZXJsYXlGaXQudmlzaWJsZUFyZWEpIHtcbiAgICAgICAgZmFsbGJhY2sgPSB7IG92ZXJsYXlGaXQsIG92ZXJsYXlQb2ludCwgb3JpZ2luUG9pbnQsIHBvc2l0aW9uOiBwb3MsIG92ZXJsYXlSZWN0IH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlcmUgYXJlIGFueSBwb3NpdGlvbnMgd2hlcmUgdGhlIG92ZXJsYXkgd291bGQgZml0IHdpdGggZmxleGlibGUgZGltZW5zaW9ucywgY2hvb3NlIHRoZVxuICAgIC8vIG9uZSB0aGF0IGhhcyB0aGUgZ3JlYXRlc3QgYXJlYSBhdmFpbGFibGUgbW9kaWZpZWQgYnkgdGhlIHBvc2l0aW9uJ3Mgd2VpZ2h0XG4gICAgaWYgKGZsZXhpYmxlRml0cy5sZW5ndGgpIHtcbiAgICAgIGxldCBiZXN0Rml0OiBGbGV4aWJsZUZpdCB8IG51bGwgPSBudWxsO1xuICAgICAgbGV0IGJlc3RTY29yZSA9IC0xO1xuICAgICAgZm9yIChjb25zdCBmaXQgb2YgZmxleGlibGVGaXRzKSB7XG4gICAgICAgIGNvbnN0IHNjb3JlID0gZml0LmJvdW5kaW5nQm94UmVjdC53aWR0aCAqIGZpdC5ib3VuZGluZ0JveFJlY3QuaGVpZ2h0ICogKGZpdC5wb3NpdGlvbi53ZWlnaHQgfHwgMSk7XG4gICAgICAgIGlmIChzY29yZSA+IGJlc3RTY29yZSkge1xuICAgICAgICAgIGJlc3RTY29yZSA9IHNjb3JlO1xuICAgICAgICAgIGJlc3RGaXQgPSBmaXQ7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdGhpcy5faXNQdXNoZWQgPSBmYWxzZTtcbiAgICAgIHRoaXMuX2FwcGx5UG9zaXRpb24oYmVzdEZpdCEucG9zaXRpb24sIGJlc3RGaXQhLm9yaWdpbik7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gV2hlbiBub25lIG9mIHRoZSBwcmVmZXJyZWQgcG9zaXRpb25zIGZpdCB3aXRoaW4gdGhlIHZpZXdwb3J0LCB0YWtlIHRoZSBwb3NpdGlvblxuICAgIC8vIHRoYXQgd2VudCBvZmYtc2NyZWVuIHRoZSBsZWFzdCBhbmQgYXR0ZW1wdCB0byBwdXNoIGl0IG9uLXNjcmVlbi5cbiAgICBpZiAodGhpcy5fY2FuUHVzaCkge1xuICAgICAgLy8gVE9ETyhqZWxib3Vybik6IGFmdGVyIHB1c2hpbmcsIHRoZSBvcGVuaW5nIFwiZGlyZWN0aW9uXCIgb2YgdGhlIG92ZXJsYXkgbWlnaHQgbm90IG1ha2Ugc2Vuc2UuXG4gICAgICB0aGlzLl9pc1B1c2hlZCA9IHRydWU7XG4gICAgICB0aGlzLl9hcHBseVBvc2l0aW9uKGZhbGxiYWNrIS5wb3NpdGlvbiwgZmFsbGJhY2shLm9yaWdpblBvaW50KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBBbGwgb3B0aW9ucyBmb3IgZ2V0dGluZyB0aGUgb3ZlcmxheSB3aXRoaW4gdGhlIHZpZXdwb3J0IGhhdmUgYmVlbiBleGhhdXN0ZWQsIHNvIGdvIHdpdGggdGhlXG4gICAgLy8gcG9zaXRpb24gdGhhdCB3ZW50IG9mZi1zY3JlZW4gdGhlIGxlYXN0LlxuICAgIHRoaXMuX2FwcGx5UG9zaXRpb24oZmFsbGJhY2shLnBvc2l0aW9uLCBmYWxsYmFjayEub3JpZ2luUG9pbnQpO1xuICB9XG5cbiAgZGV0YWNoKCk6IHZvaWQge1xuICAgIHRoaXMuX2NsZWFyUGFuZWxDbGFzc2VzKCk7XG4gICAgdGhpcy5fbGFzdFBvc2l0aW9uID0gbnVsbDtcbiAgICB0aGlzLl9wcmV2aW91c1B1c2hBbW91bnQgPSBudWxsO1xuICAgIHRoaXMuX3Jlc2l6ZVN1YnNjcmlwdGlvbi51bnN1YnNjcmliZSgpO1xuICB9XG5cbiAgLyoqIENsZWFudXAgYWZ0ZXIgdGhlIGVsZW1lbnQgZ2V0cyBkZXN0cm95ZWQuICovXG4gIGRpc3Bvc2UoKTogdm9pZCB7XG4gICAgaWYgKHRoaXMuX2lzRGlzcG9zZWQpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBXZSBjYW4ndCB1c2UgYF9yZXNldEJvdW5kaW5nQm94U3R5bGVzYCBoZXJlLCBiZWNhdXNlIGl0IHJlc2V0c1xuICAgIC8vIHNvbWUgcHJvcGVydGllcyB0byB6ZXJvLCByYXRoZXIgdGhhbiByZW1vdmluZyB0aGVtLlxuICAgIGlmICh0aGlzLl9ib3VuZGluZ0JveCkge1xuICAgICAgZXh0ZW5kU3R5bGVzKHRoaXMuX2JvdW5kaW5nQm94LnN0eWxlLCB7XG4gICAgICAgIHRvcDogJycsXG4gICAgICAgIGxlZnQ6ICcnLFxuICAgICAgICByaWdodDogJycsXG4gICAgICAgIGJvdHRvbTogJycsXG4gICAgICAgIGhlaWdodDogJycsXG4gICAgICAgIHdpZHRoOiAnJyxcbiAgICAgICAgYWxpZ25JdGVtczogJycsXG4gICAgICAgIGp1c3RpZnlDb250ZW50OiAnJyxcbiAgICAgIH0gYXMgQ1NTU3R5bGVEZWNsYXJhdGlvbik7XG4gICAgfVxuXG4gICAgaWYgKHRoaXMuX3BhbmUpIHtcbiAgICAgIHRoaXMuX3Jlc2V0T3ZlcmxheUVsZW1lbnRTdHlsZXMoKTtcbiAgICB9XG5cbiAgICBpZiAodGhpcy5fb3ZlcmxheVJlZikge1xuICAgICAgdGhpcy5fb3ZlcmxheVJlZi5ob3N0RWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKGJvdW5kaW5nQm94Q2xhc3MpO1xuICAgIH1cblxuICAgIHRoaXMuZGV0YWNoKCk7XG4gICAgdGhpcy5fcG9zaXRpb25DaGFuZ2VzLmNvbXBsZXRlKCk7XG4gICAgdGhpcy5fb3ZlcmxheVJlZiA9IHRoaXMuX2JvdW5kaW5nQm94ID0gbnVsbCE7XG4gICAgdGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyByZS1hbGlnbnMgdGhlIG92ZXJsYXkgZWxlbWVudCB3aXRoIHRoZSB0cmlnZ2VyIGluIGl0cyBsYXN0IGNhbGN1bGF0ZWQgcG9zaXRpb24sXG4gICAqIGV2ZW4gaWYgYSBwb3NpdGlvbiBoaWdoZXIgaW4gdGhlIFwicHJlZmVycmVkIHBvc2l0aW9uc1wiIGxpc3Qgd291bGQgbm93IGZpdC4gVGhpc1xuICAgKiBhbGxvd3Mgb25lIHRvIHJlLWFsaWduIHRoZSBwYW5lbCB3aXRob3V0IGNoYW5naW5nIHRoZSBvcmllbnRhdGlvbiBvZiB0aGUgcGFuZWwuXG4gICAqL1xuICByZWFwcGx5TGFzdFBvc2l0aW9uKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9pc0Rpc3Bvc2VkIHx8ICF0aGlzLl9wbGF0Zm9ybS5pc0Jyb3dzZXIpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBsYXN0UG9zaXRpb24gPSB0aGlzLl9sYXN0UG9zaXRpb247XG5cbiAgICBpZiAobGFzdFBvc2l0aW9uKSB7XG4gICAgICB0aGlzLl9vcmlnaW5SZWN0ID0gdGhpcy5fZ2V0T3JpZ2luUmVjdCgpO1xuICAgICAgdGhpcy5fb3ZlcmxheVJlY3QgPSB0aGlzLl9wYW5lLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgdGhpcy5fdmlld3BvcnRSZWN0ID0gdGhpcy5fZ2V0TmFycm93ZWRWaWV3cG9ydFJlY3QoKTtcbiAgICAgIHRoaXMuX2NvbnRhaW5lclJlY3QgPSB0aGlzLl9vdmVybGF5Q29udGFpbmVyLmdldENvbnRhaW5lckVsZW1lbnQoKS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblxuICAgICAgY29uc3Qgb3JpZ2luUG9pbnQgPSB0aGlzLl9nZXRPcmlnaW5Qb2ludCh0aGlzLl9vcmlnaW5SZWN0LCB0aGlzLl9jb250YWluZXJSZWN0LCBsYXN0UG9zaXRpb24pO1xuICAgICAgdGhpcy5fYXBwbHlQb3NpdGlvbihsYXN0UG9zaXRpb24sIG9yaWdpblBvaW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5hcHBseSgpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBsaXN0IG9mIFNjcm9sbGFibGUgY29udGFpbmVycyB0aGF0IGhvc3QgdGhlIG9yaWdpbiBlbGVtZW50IHNvIHRoYXRcbiAgICogb24gcmVwb3NpdGlvbiB3ZSBjYW4gZXZhbHVhdGUgaWYgaXQgb3IgdGhlIG92ZXJsYXkgaGFzIGJlZW4gY2xpcHBlZCBvciBvdXRzaWRlIHZpZXcuIEV2ZXJ5XG4gICAqIFNjcm9sbGFibGUgbXVzdCBiZSBhbiBhbmNlc3RvciBlbGVtZW50IG9mIHRoZSBzdHJhdGVneSdzIG9yaWdpbiBlbGVtZW50LlxuICAgKi9cbiAgd2l0aFNjcm9sbGFibGVDb250YWluZXJzKHNjcm9sbGFibGVzOiBDZGtTY3JvbGxhYmxlW10pOiB0aGlzIHtcbiAgICB0aGlzLl9zY3JvbGxhYmxlcyA9IHNjcm9sbGFibGVzO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZHMgbmV3IHByZWZlcnJlZCBwb3NpdGlvbnMuXG4gICAqIEBwYXJhbSBwb3NpdGlvbnMgTGlzdCBvZiBwb3NpdGlvbnMgb3B0aW9ucyBmb3IgdGhpcyBvdmVybGF5LlxuICAgKi9cbiAgd2l0aFBvc2l0aW9ucyhwb3NpdGlvbnM6IENvbm5lY3RlZFBvc2l0aW9uW10pOiB0aGlzIHtcbiAgICB0aGlzLl9wcmVmZXJyZWRQb3NpdGlvbnMgPSBwb3NpdGlvbnM7XG5cbiAgICAvLyBJZiB0aGUgbGFzdCBjYWxjdWxhdGVkIHBvc2l0aW9uIG9iamVjdCBpc24ndCBwYXJ0IG9mIHRoZSBwb3NpdGlvbnMgYW55bW9yZSwgY2xlYXJcbiAgICAvLyBpdCBpbiBvcmRlciB0byBhdm9pZCBpdCBiZWluZyBwaWNrZWQgdXAgaWYgdGhlIGNvbnN1bWVyIHRyaWVzIHRvIHJlLWFwcGx5LlxuICAgIGlmIChwb3NpdGlvbnMuaW5kZXhPZih0aGlzLl9sYXN0UG9zaXRpb24hKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuX2xhc3RQb3NpdGlvbiA9IG51bGw7XG4gICAgfVxuXG4gICAgdGhpcy5fdmFsaWRhdGVQb3NpdGlvbnMoKTtcblxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgYSBtaW5pbXVtIGRpc3RhbmNlIHRoZSBvdmVybGF5IG1heSBiZSBwb3NpdGlvbmVkIHRvIHRoZSBlZGdlIG9mIHRoZSB2aWV3cG9ydC5cbiAgICogQHBhcmFtIG1hcmdpbiBSZXF1aXJlZCBtYXJnaW4gYmV0d2VlbiB0aGUgb3ZlcmxheSBhbmQgdGhlIHZpZXdwb3J0IGVkZ2UgaW4gcGl4ZWxzLlxuICAgKi9cbiAgd2l0aFZpZXdwb3J0TWFyZ2luKG1hcmdpbjogbnVtYmVyKTogdGhpcyB7XG4gICAgdGhpcy5fdmlld3BvcnRNYXJnaW4gPSBtYXJnaW47XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKiogU2V0cyB3aGV0aGVyIHRoZSBvdmVybGF5J3Mgd2lkdGggYW5kIGhlaWdodCBjYW4gYmUgY29uc3RyYWluZWQgdG8gZml0IHdpdGhpbiB0aGUgdmlld3BvcnQuICovXG4gIHdpdGhGbGV4aWJsZURpbWVuc2lvbnMoZmxleGlibGVEaW1lbnNpb25zID0gdHJ1ZSk6IHRoaXMge1xuICAgIHRoaXMuX2hhc0ZsZXhpYmxlRGltZW5zaW9ucyA9IGZsZXhpYmxlRGltZW5zaW9ucztcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKiBTZXRzIHdoZXRoZXIgdGhlIG92ZXJsYXkgY2FuIGdyb3cgYWZ0ZXIgdGhlIGluaXRpYWwgb3BlbiB2aWEgZmxleGlibGUgd2lkdGgvaGVpZ2h0LiAqL1xuICB3aXRoR3Jvd0FmdGVyT3Blbihncm93QWZ0ZXJPcGVuID0gdHJ1ZSk6IHRoaXMge1xuICAgIHRoaXMuX2dyb3dBZnRlck9wZW4gPSBncm93QWZ0ZXJPcGVuO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqIFNldHMgd2hldGhlciB0aGUgb3ZlcmxheSBjYW4gYmUgcHVzaGVkIG9uLXNjcmVlbiBpZiBub25lIG9mIHRoZSBwcm92aWRlZCBwb3NpdGlvbnMgZml0LiAqL1xuICB3aXRoUHVzaChjYW5QdXNoID0gdHJ1ZSk6IHRoaXMge1xuICAgIHRoaXMuX2NhblB1c2ggPSBjYW5QdXNoO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHMgd2hldGhlciB0aGUgb3ZlcmxheSdzIHBvc2l0aW9uIHNob3VsZCBiZSBsb2NrZWQgaW4gYWZ0ZXIgaXQgaXMgcG9zaXRpb25lZFxuICAgKiBpbml0aWFsbHkuIFdoZW4gYW4gb3ZlcmxheSBpcyBsb2NrZWQgaW4sIGl0IHdvbid0IGF0dGVtcHQgdG8gcmVwb3NpdGlvbiBpdHNlbGZcbiAgICogd2hlbiB0aGUgcG9zaXRpb24gaXMgcmUtYXBwbGllZCAoZS5nLiB3aGVuIHRoZSB1c2VyIHNjcm9sbHMgYXdheSkuXG4gICAqIEBwYXJhbSBpc0xvY2tlZCBXaGV0aGVyIHRoZSBvdmVybGF5IHNob3VsZCBsb2NrZWQgaW4uXG4gICAqL1xuICB3aXRoTG9ja2VkUG9zaXRpb24oaXNMb2NrZWQgPSB0cnVlKTogdGhpcyB7XG4gICAgdGhpcy5fcG9zaXRpb25Mb2NrZWQgPSBpc0xvY2tlZDtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBvcmlnaW4sIHJlbGF0aXZlIHRvIHdoaWNoIHRvIHBvc2l0aW9uIHRoZSBvdmVybGF5LlxuICAgKiBVc2luZyBhbiBlbGVtZW50IG9yaWdpbiBpcyB1c2VmdWwgZm9yIGJ1aWxkaW5nIGNvbXBvbmVudHMgdGhhdCBuZWVkIHRvIGJlIHBvc2l0aW9uZWRcbiAgICogcmVsYXRpdmVseSB0byBhIHRyaWdnZXIgKGUuZy4gZHJvcGRvd24gbWVudXMgb3IgdG9vbHRpcHMpLCB3aGVyZWFzIHVzaW5nIGEgcG9pbnQgY2FuIGJlXG4gICAqIHVzZWQgZm9yIGNhc2VzIGxpa2UgY29udGV4dHVhbCBtZW51cyB3aGljaCBvcGVuIHJlbGF0aXZlIHRvIHRoZSB1c2VyJ3MgcG9pbnRlci5cbiAgICogQHBhcmFtIG9yaWdpbiBSZWZlcmVuY2UgdG8gdGhlIG5ldyBvcmlnaW4uXG4gICAqL1xuICBzZXRPcmlnaW4ob3JpZ2luOiBGbGV4aWJsZUNvbm5lY3RlZFBvc2l0aW9uU3RyYXRlZ3lPcmlnaW4pOiB0aGlzIHtcbiAgICB0aGlzLl9vcmlnaW4gPSBvcmlnaW47XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgZGVmYXVsdCBvZmZzZXQgZm9yIHRoZSBvdmVybGF5J3MgY29ubmVjdGlvbiBwb2ludCBvbiB0aGUgeC1heGlzLlxuICAgKiBAcGFyYW0gb2Zmc2V0IE5ldyBvZmZzZXQgaW4gdGhlIFggYXhpcy5cbiAgICovXG4gIHdpdGhEZWZhdWx0T2Zmc2V0WChvZmZzZXQ6IG51bWJlcik6IHRoaXMge1xuICAgIHRoaXMuX29mZnNldFggPSBvZmZzZXQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogU2V0cyB0aGUgZGVmYXVsdCBvZmZzZXQgZm9yIHRoZSBvdmVybGF5J3MgY29ubmVjdGlvbiBwb2ludCBvbiB0aGUgeS1heGlzLlxuICAgKiBAcGFyYW0gb2Zmc2V0IE5ldyBvZmZzZXQgaW4gdGhlIFkgYXhpcy5cbiAgICovXG4gIHdpdGhEZWZhdWx0T2Zmc2V0WShvZmZzZXQ6IG51bWJlcik6IHRoaXMge1xuICAgIHRoaXMuX29mZnNldFkgPSBvZmZzZXQ7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuICAvKipcbiAgICogQ29uZmlndXJlcyB0aGF0IHRoZSBwb3NpdGlvbiBzdHJhdGVneSBzaG91bGQgc2V0IGEgYHRyYW5zZm9ybS1vcmlnaW5gIG9uIHNvbWUgZWxlbWVudHNcbiAgICogaW5zaWRlIHRoZSBvdmVybGF5LCBkZXBlbmRpbmcgb24gdGhlIGN1cnJlbnQgcG9zaXRpb24gdGhhdCBpcyBiZWluZyBhcHBsaWVkLiBUaGlzIGlzXG4gICAqIHVzZWZ1bCBmb3IgdGhlIGNhc2VzIHdoZXJlIHRoZSBvcmlnaW4gb2YgYW4gYW5pbWF0aW9uIGNhbiBjaGFuZ2UgZGVwZW5kaW5nIG9uIHRoZVxuICAgKiBhbGlnbm1lbnQgb2YgdGhlIG92ZXJsYXkuXG4gICAqIEBwYXJhbSBzZWxlY3RvciBDU1Mgc2VsZWN0b3IgdGhhdCB3aWxsIGJlIHVzZWQgdG8gZmluZCB0aGUgdGFyZ2V0XG4gICAqICAgIGVsZW1lbnRzIG9udG8gd2hpY2ggdG8gc2V0IHRoZSB0cmFuc2Zvcm0gb3JpZ2luLlxuICAgKi9cbiAgd2l0aFRyYW5zZm9ybU9yaWdpbk9uKHNlbGVjdG9yOiBzdHJpbmcpOiB0aGlzIHtcbiAgICB0aGlzLl90cmFuc2Zvcm1PcmlnaW5TZWxlY3RvciA9IHNlbGVjdG9yO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlICh4LCB5KSBjb29yZGluYXRlIG9mIGEgY29ubmVjdGlvbiBwb2ludCBvbiB0aGUgb3JpZ2luIGJhc2VkIG9uIGEgcmVsYXRpdmUgcG9zaXRpb24uXG4gICAqL1xuICBwcml2YXRlIF9nZXRPcmlnaW5Qb2ludChvcmlnaW5SZWN0OiBEaW1lbnNpb25zLCBjb250YWluZXJSZWN0OiBEaW1lbnNpb25zLCBwb3M6IENvbm5lY3RlZFBvc2l0aW9uKTogUG9pbnQge1xuICAgIGxldCB4OiBudW1iZXI7XG4gICAgaWYgKHBvcy5vcmlnaW5YID09ICdjZW50ZXInKSB7XG4gICAgICAvLyBOb3RlOiB3aGVuIGNlbnRlcmluZyB3ZSBzaG91bGQgYWx3YXlzIHVzZSB0aGUgYGxlZnRgXG4gICAgICAvLyBvZmZzZXQsIG90aGVyd2lzZSB0aGUgcG9zaXRpb24gd2lsbCBiZSB3cm9uZyBpbiBSVEwuXG4gICAgICB4ID0gb3JpZ2luUmVjdC5sZWZ0ICsgb3JpZ2luUmVjdC53aWR0aCAvIDI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IHN0YXJ0WCA9IHRoaXMuX2lzUnRsKCkgPyBvcmlnaW5SZWN0LnJpZ2h0IDogb3JpZ2luUmVjdC5sZWZ0O1xuICAgICAgY29uc3QgZW5kWCA9IHRoaXMuX2lzUnRsKCkgPyBvcmlnaW5SZWN0LmxlZnQgOiBvcmlnaW5SZWN0LnJpZ2h0O1xuICAgICAgeCA9IHBvcy5vcmlnaW5YID09ICdzdGFydCcgPyBzdGFydFggOiBlbmRYO1xuICAgIH1cblxuICAgIC8vIFdoZW4gem9vbWluZyBpbiBTYWZhcmkgdGhlIGNvbnRhaW5lciByZWN0YW5nbGUgY29udGFpbnMgbmVnYXRpdmUgdmFsdWVzIGZvciB0aGUgcG9zaXRpb25cbiAgICAvLyBhbmQgd2UgbmVlZCB0byByZS1hZGQgdGhlbSB0byB0aGUgY2FsY3VsYXRlZCBjb29yZGluYXRlcy5cbiAgICBpZiAoY29udGFpbmVyUmVjdC5sZWZ0IDwgMCkge1xuICAgICAgeCAtPSBjb250YWluZXJSZWN0LmxlZnQ7XG4gICAgfVxuXG4gICAgbGV0IHk6IG51bWJlcjtcbiAgICBpZiAocG9zLm9yaWdpblkgPT0gJ2NlbnRlcicpIHtcbiAgICAgIHkgPSBvcmlnaW5SZWN0LnRvcCArIG9yaWdpblJlY3QuaGVpZ2h0IC8gMjtcbiAgICB9IGVsc2Uge1xuICAgICAgeSA9IHBvcy5vcmlnaW5ZID09ICd0b3AnID8gb3JpZ2luUmVjdC50b3AgOiBvcmlnaW5SZWN0LmJvdHRvbTtcbiAgICB9XG5cbiAgICAvLyBOb3JtYWxseSB0aGUgY29udGFpbmVyUmVjdCdzIHRvcCB2YWx1ZSB3b3VsZCBiZSB6ZXJvLCBob3dldmVyIHdoZW4gdGhlIG92ZXJsYXkgaXMgYXR0YWNoZWQgdG8gYW4gaW5wdXRcbiAgICAvLyAoZS5nLiBpbiBhbiBhdXRvY29tcGxldGUpLCBtb2JpbGUgYnJvd3NlcnMgd2lsbCBzaGlmdCBldmVyeXRoaW5nIGluIG9yZGVyIHRvIHB1dCB0aGUgaW5wdXQgaW4gdGhlIG1pZGRsZVxuICAgIC8vIG9mIHRoZSBzY3JlZW4gYW5kIHRvIG1ha2Ugc3BhY2UgZm9yIHRoZSB2aXJ0dWFsIGtleWJvYXJkLiBXZSBuZWVkIHRvIGFjY291bnQgZm9yIHRoaXMgb2Zmc2V0LFxuICAgIC8vIG90aGVyd2lzZSBvdXIgcG9zaXRpb25pbmcgd2lsbCBiZSB0aHJvd24gb2ZmLlxuICAgIC8vIEFkZGl0aW9uYWxseSwgd2hlbiB6b29taW5nIGluIFNhZmFyaSB0aGlzIGZpeGVzIHRoZSB2ZXJ0aWNhbCBwb3NpdGlvbi5cbiAgICBpZiAoY29udGFpbmVyUmVjdC50b3AgPCAwKSB7XG4gICAgICB5IC09IGNvbnRhaW5lclJlY3QudG9wO1xuICAgIH1cblxuICAgIHJldHVybiB7IHgsIHkgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSAoeCwgeSkgY29vcmRpbmF0ZSBvZiB0aGUgdG9wLWxlZnQgY29ybmVyIG9mIHRoZSBvdmVybGF5IGdpdmVuIGEgZ2l2ZW4gcG9zaXRpb24gYW5kXG4gICAqIG9yaWdpbiBwb2ludCB0byB3aGljaCB0aGUgb3ZlcmxheSBzaG91bGQgYmUgY29ubmVjdGVkLlxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0T3ZlcmxheVBvaW50KG9yaWdpblBvaW50OiBQb2ludCwgb3ZlcmxheVJlY3Q6IERpbWVuc2lvbnMsIHBvczogQ29ubmVjdGVkUG9zaXRpb24pOiBQb2ludCB7XG4gICAgLy8gQ2FsY3VsYXRlIHRoZSAob3ZlcmxheVN0YXJ0WCwgb3ZlcmxheVN0YXJ0WSksIHRoZSBzdGFydCBvZiB0aGVcbiAgICAvLyBwb3RlbnRpYWwgb3ZlcmxheSBwb3NpdGlvbiByZWxhdGl2ZSB0byB0aGUgb3JpZ2luIHBvaW50LlxuICAgIGxldCBvdmVybGF5U3RhcnRYOiBudW1iZXI7XG4gICAgaWYgKHBvcy5vdmVybGF5WCA9PSAnY2VudGVyJykge1xuICAgICAgb3ZlcmxheVN0YXJ0WCA9IC1vdmVybGF5UmVjdC53aWR0aCAvIDI7XG4gICAgfSBlbHNlIGlmIChwb3Mub3ZlcmxheVggPT09ICdzdGFydCcpIHtcbiAgICAgIG92ZXJsYXlTdGFydFggPSB0aGlzLl9pc1J0bCgpID8gLW92ZXJsYXlSZWN0LndpZHRoIDogMDtcbiAgICB9IGVsc2Uge1xuICAgICAgb3ZlcmxheVN0YXJ0WCA9IHRoaXMuX2lzUnRsKCkgPyAwIDogLW92ZXJsYXlSZWN0LndpZHRoO1xuICAgIH1cblxuICAgIGxldCBvdmVybGF5U3RhcnRZOiBudW1iZXI7XG4gICAgaWYgKHBvcy5vdmVybGF5WSA9PSAnY2VudGVyJykge1xuICAgICAgb3ZlcmxheVN0YXJ0WSA9IC1vdmVybGF5UmVjdC5oZWlnaHQgLyAyO1xuICAgIH0gZWxzZSB7XG4gICAgICBvdmVybGF5U3RhcnRZID0gcG9zLm92ZXJsYXlZID09ICd0b3AnID8gMCA6IC1vdmVybGF5UmVjdC5oZWlnaHQ7XG4gICAgfVxuXG4gICAgLy8gVGhlICh4LCB5KSBjb29yZGluYXRlcyBvZiB0aGUgb3ZlcmxheS5cbiAgICByZXR1cm4ge1xuICAgICAgeDogb3JpZ2luUG9pbnQueCArIG92ZXJsYXlTdGFydFgsXG4gICAgICB5OiBvcmlnaW5Qb2ludC55ICsgb3ZlcmxheVN0YXJ0WSxcbiAgICB9O1xuICB9XG5cbiAgLyoqIEdldHMgaG93IHdlbGwgYW4gb3ZlcmxheSBhdCB0aGUgZ2l2ZW4gcG9pbnQgd2lsbCBmaXQgd2l0aGluIHRoZSB2aWV3cG9ydC4gKi9cbiAgcHJpdmF0ZSBfZ2V0T3ZlcmxheUZpdChcbiAgICBwb2ludDogUG9pbnQsXG4gICAgcmF3T3ZlcmxheVJlY3Q6IERpbWVuc2lvbnMsXG4gICAgdmlld3BvcnQ6IERpbWVuc2lvbnMsXG4gICAgcG9zaXRpb246IENvbm5lY3RlZFBvc2l0aW9uLFxuICApOiBPdmVybGF5Rml0IHtcbiAgICAvLyBSb3VuZCB0aGUgb3ZlcmxheSByZWN0IHdoZW4gY29tcGFyaW5nIGFnYWluc3QgdGhlXG4gICAgLy8gdmlld3BvcnQsIGJlY2F1c2UgdGhlIHZpZXdwb3J0IGlzIGFsd2F5cyByb3VuZGVkLlxuICAgIGNvbnN0IG92ZXJsYXkgPSBnZXRSb3VuZGVkQm91bmRpbmdDbGllbnRSZWN0KHJhd092ZXJsYXlSZWN0KTtcbiAgICBsZXQgeyB4LCB5IH0gPSBwb2ludDtcbiAgICBsZXQgb2Zmc2V0WCA9IHRoaXMuX2dldE9mZnNldChwb3NpdGlvbiwgJ3gnKTtcbiAgICBsZXQgb2Zmc2V0WSA9IHRoaXMuX2dldE9mZnNldChwb3NpdGlvbiwgJ3knKTtcblxuICAgIC8vIEFjY291bnQgZm9yIHRoZSBvZmZzZXRzIHNpbmNlIHRoZXkgY291bGQgcHVzaCB0aGUgb3ZlcmxheSBvdXQgb2YgdGhlIHZpZXdwb3J0LlxuICAgIGlmIChvZmZzZXRYKSB7XG4gICAgICB4ICs9IG9mZnNldFg7XG4gICAgfVxuXG4gICAgaWYgKG9mZnNldFkpIHtcbiAgICAgIHkgKz0gb2Zmc2V0WTtcbiAgICB9XG5cbiAgICAvLyBIb3cgbXVjaCB0aGUgb3ZlcmxheSB3b3VsZCBvdmVyZmxvdyBhdCB0aGlzIHBvc2l0aW9uLCBvbiBlYWNoIHNpZGUuXG4gICAgbGV0IGxlZnRPdmVyZmxvdyA9IDAgLSB4O1xuICAgIGxldCByaWdodE92ZXJmbG93ID0geCArIG92ZXJsYXkud2lkdGggLSB2aWV3cG9ydC53aWR0aDtcbiAgICBsZXQgdG9wT3ZlcmZsb3cgPSAwIC0geTtcbiAgICBsZXQgYm90dG9tT3ZlcmZsb3cgPSB5ICsgb3ZlcmxheS5oZWlnaHQgLSB2aWV3cG9ydC5oZWlnaHQ7XG5cbiAgICAvLyBWaXNpYmxlIHBhcnRzIG9mIHRoZSBlbGVtZW50IG9uIGVhY2ggYXhpcy5cbiAgICBsZXQgdmlzaWJsZVdpZHRoID0gdGhpcy5fc3VidHJhY3RPdmVyZmxvd3Mob3ZlcmxheS53aWR0aCwgbGVmdE92ZXJmbG93LCByaWdodE92ZXJmbG93KTtcbiAgICBsZXQgdmlzaWJsZUhlaWdodCA9IHRoaXMuX3N1YnRyYWN0T3ZlcmZsb3dzKG92ZXJsYXkuaGVpZ2h0LCB0b3BPdmVyZmxvdywgYm90dG9tT3ZlcmZsb3cpO1xuICAgIGxldCB2aXNpYmxlQXJlYSA9IHZpc2libGVXaWR0aCAqIHZpc2libGVIZWlnaHQ7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdmlzaWJsZUFyZWEsXG4gICAgICBpc0NvbXBsZXRlbHlXaXRoaW5WaWV3cG9ydDogb3ZlcmxheS53aWR0aCAqIG92ZXJsYXkuaGVpZ2h0ID09PSB2aXNpYmxlQXJlYSxcbiAgICAgIGZpdHNJblZpZXdwb3J0VmVydGljYWxseTogdmlzaWJsZUhlaWdodCA9PT0gb3ZlcmxheS5oZWlnaHQsXG4gICAgICBmaXRzSW5WaWV3cG9ydEhvcml6b250YWxseTogdmlzaWJsZVdpZHRoID09IG92ZXJsYXkud2lkdGgsXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRoZSBvdmVybGF5IGNhbiBmaXQgd2l0aGluIHRoZSB2aWV3cG9ydCB3aGVuIGl0IG1heSByZXNpemUgZWl0aGVyIGl0cyB3aWR0aCBvciBoZWlnaHQuXG4gICAqIEBwYXJhbSBmaXQgSG93IHdlbGwgdGhlIG92ZXJsYXkgZml0cyBpbiB0aGUgdmlld3BvcnQgYXQgc29tZSBwb3NpdGlvbi5cbiAgICogQHBhcmFtIHBvaW50IFRoZSAoeCwgeSkgY29vcmRpbmF0ZXMgb2YgdGhlIG92ZXJsYXkgYXQgc29tZSBwb3NpdGlvbi5cbiAgICogQHBhcmFtIHZpZXdwb3J0IFRoZSBnZW9tZXRyeSBvZiB0aGUgdmlld3BvcnQuXG4gICAqL1xuICBwcml2YXRlIF9jYW5GaXRXaXRoRmxleGlibGVEaW1lbnNpb25zKGZpdDogT3ZlcmxheUZpdCwgcG9pbnQ6IFBvaW50LCB2aWV3cG9ydDogRGltZW5zaW9ucykge1xuICAgIGlmICh0aGlzLl9oYXNGbGV4aWJsZURpbWVuc2lvbnMpIHtcbiAgICAgIGNvbnN0IGF2YWlsYWJsZUhlaWdodCA9IHZpZXdwb3J0LmJvdHRvbSAtIHBvaW50Lnk7XG4gICAgICBjb25zdCBhdmFpbGFibGVXaWR0aCA9IHZpZXdwb3J0LnJpZ2h0IC0gcG9pbnQueDtcbiAgICAgIGNvbnN0IG1pbkhlaWdodCA9IGdldFBpeGVsVmFsdWUodGhpcy5fb3ZlcmxheVJlZi5nZXRDb25maWcoKS5taW5IZWlnaHQpO1xuICAgICAgY29uc3QgbWluV2lkdGggPSBnZXRQaXhlbFZhbHVlKHRoaXMuX292ZXJsYXlSZWYuZ2V0Q29uZmlnKCkubWluV2lkdGgpO1xuXG4gICAgICBjb25zdCB2ZXJ0aWNhbEZpdCA9IGZpdC5maXRzSW5WaWV3cG9ydFZlcnRpY2FsbHkgfHwgKG1pbkhlaWdodCAhPSBudWxsICYmIG1pbkhlaWdodCA8PSBhdmFpbGFibGVIZWlnaHQpO1xuICAgICAgY29uc3QgaG9yaXpvbnRhbEZpdCA9IGZpdC5maXRzSW5WaWV3cG9ydEhvcml6b250YWxseSB8fCAobWluV2lkdGggIT0gbnVsbCAmJiBtaW5XaWR0aCA8PSBhdmFpbGFibGVXaWR0aCk7XG5cbiAgICAgIHJldHVybiB2ZXJ0aWNhbEZpdCAmJiBob3Jpem9udGFsRml0O1xuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogR2V0cyB0aGUgcG9pbnQgYXQgd2hpY2ggdGhlIG92ZXJsYXkgY2FuIGJlIFwicHVzaGVkXCIgb24tc2NyZWVuLiBJZiB0aGUgb3ZlcmxheSBpcyBsYXJnZXIgdGhhblxuICAgKiB0aGUgdmlld3BvcnQsIHRoZSB0b3AtbGVmdCBjb3JuZXIgd2lsbCBiZSBwdXNoZWQgb24tc2NyZWVuICh3aXRoIG92ZXJmbG93IG9jY3VycmluZyBvbiB0aGVcbiAgICogcmlnaHQgYW5kIGJvdHRvbSkuXG4gICAqXG4gICAqIEBwYXJhbSBzdGFydCBTdGFydGluZyBwb2ludCBmcm9tIHdoaWNoIHRoZSBvdmVybGF5IGlzIHB1c2hlZC5cbiAgICogQHBhcmFtIHJhd092ZXJsYXlSZWN0IERpbWVuc2lvbnMgb2YgdGhlIG92ZXJsYXkuXG4gICAqIEBwYXJhbSBzY3JvbGxQb3NpdGlvbiBDdXJyZW50IHZpZXdwb3J0IHNjcm9sbCBwb3NpdGlvbi5cbiAgICogQHJldHVybnMgVGhlIHBvaW50IGF0IHdoaWNoIHRvIHBvc2l0aW9uIHRoZSBvdmVybGF5IGFmdGVyIHB1c2hpbmcuIFRoaXMgaXMgZWZmZWN0aXZlbHkgYSBuZXdcbiAgICogICAgIG9yaWdpblBvaW50LlxuICAgKi9cbiAgcHJpdmF0ZSBfcHVzaE92ZXJsYXlPblNjcmVlbihcbiAgICBzdGFydDogUG9pbnQsXG4gICAgcmF3T3ZlcmxheVJlY3Q6IERpbWVuc2lvbnMsXG4gICAgc2Nyb2xsUG9zaXRpb246IFZpZXdwb3J0U2Nyb2xsUG9zaXRpb24sXG4gICk6IFBvaW50IHtcbiAgICAvLyBJZiB0aGUgcG9zaXRpb24gaXMgbG9ja2VkIGFuZCB3ZSd2ZSBwdXNoZWQgdGhlIG92ZXJsYXkgYWxyZWFkeSwgcmV1c2UgdGhlIHByZXZpb3VzIHB1c2hcbiAgICAvLyBhbW91bnQsIHJhdGhlciB0aGFuIHB1c2hpbmcgaXQgYWdhaW4uIElmIHdlIHdlcmUgdG8gY29udGludWUgcHVzaGluZywgdGhlIGVsZW1lbnQgd291bGRcbiAgICAvLyByZW1haW4gaW4gdGhlIHZpZXdwb3J0LCB3aGljaCBnb2VzIGFnYWluc3QgdGhlIGV4cGVjdGF0aW9ucyB3aGVuIHBvc2l0aW9uIGxvY2tpbmcgaXMgZW5hYmxlZC5cbiAgICBpZiAodGhpcy5fcHJldmlvdXNQdXNoQW1vdW50ICYmIHRoaXMuX3Bvc2l0aW9uTG9ja2VkKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB4OiBzdGFydC54ICsgdGhpcy5fcHJldmlvdXNQdXNoQW1vdW50LngsXG4gICAgICAgIHk6IHN0YXJ0LnkgKyB0aGlzLl9wcmV2aW91c1B1c2hBbW91bnQueSxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgLy8gUm91bmQgdGhlIG92ZXJsYXkgcmVjdCB3aGVuIGNvbXBhcmluZyBhZ2FpbnN0IHRoZVxuICAgIC8vIHZpZXdwb3J0LCBiZWNhdXNlIHRoZSB2aWV3cG9ydCBpcyBhbHdheXMgcm91bmRlZC5cbiAgICBjb25zdCBvdmVybGF5ID0gZ2V0Um91bmRlZEJvdW5kaW5nQ2xpZW50UmVjdChyYXdPdmVybGF5UmVjdCk7XG4gICAgY29uc3Qgdmlld3BvcnQgPSB0aGlzLl92aWV3cG9ydFJlY3Q7XG5cbiAgICAvLyBEZXRlcm1pbmUgaG93IG11Y2ggdGhlIG92ZXJsYXkgZ29lcyBvdXRzaWRlIHRoZSB2aWV3cG9ydCBvbiBlYWNoXG4gICAgLy8gc2lkZSwgd2hpY2ggd2UnbGwgdXNlIHRvIGRlY2lkZSB3aGljaCBkaXJlY3Rpb24gdG8gcHVzaCBpdC5cbiAgICBjb25zdCBvdmVyZmxvd1JpZ2h0ID0gTWF0aC5tYXgoc3RhcnQueCArIG92ZXJsYXkud2lkdGggLSB2aWV3cG9ydC53aWR0aCwgMCk7XG4gICAgY29uc3Qgb3ZlcmZsb3dCb3R0b20gPSBNYXRoLm1heChzdGFydC55ICsgb3ZlcmxheS5oZWlnaHQgLSB2aWV3cG9ydC5oZWlnaHQsIDApO1xuICAgIGNvbnN0IG92ZXJmbG93VG9wID0gTWF0aC5tYXgodmlld3BvcnQudG9wIC0gc2Nyb2xsUG9zaXRpb24udG9wIC0gc3RhcnQueSwgMCk7XG4gICAgY29uc3Qgb3ZlcmZsb3dMZWZ0ID0gTWF0aC5tYXgodmlld3BvcnQubGVmdCAtIHNjcm9sbFBvc2l0aW9uLmxlZnQgLSBzdGFydC54LCAwKTtcblxuICAgIC8vIEFtb3VudCBieSB3aGljaCB0byBwdXNoIHRoZSBvdmVybGF5IGluIGVhY2ggYXhpcyBzdWNoIHRoYXQgaXQgcmVtYWlucyBvbi1zY3JlZW4uXG4gICAgbGV0IHB1c2hYID0gMDtcbiAgICBsZXQgcHVzaFkgPSAwO1xuXG4gICAgLy8gSWYgdGhlIG92ZXJsYXkgZml0cyBjb21wbGV0ZWx5IHdpdGhpbiB0aGUgYm91bmRzIG9mIHRoZSB2aWV3cG9ydCwgcHVzaCBpdCBmcm9tIHdoaWNoZXZlclxuICAgIC8vIGRpcmVjdGlvbiBpcyBnb2VzIG9mZi1zY3JlZW4uIE90aGVyd2lzZSwgcHVzaCB0aGUgdG9wLWxlZnQgY29ybmVyIHN1Y2ggdGhhdCBpdHMgaW4gdGhlXG4gICAgLy8gdmlld3BvcnQgYW5kIGFsbG93IGZvciB0aGUgdHJhaWxpbmcgZW5kIG9mIHRoZSBvdmVybGF5IHRvIGdvIG91dCBvZiBib3VuZHMuXG4gICAgaWYgKG92ZXJsYXkud2lkdGggPD0gdmlld3BvcnQud2lkdGgpIHtcbiAgICAgIHB1c2hYID0gb3ZlcmZsb3dMZWZ0IHx8IC1vdmVyZmxvd1JpZ2h0O1xuICAgIH0gZWxzZSB7XG4gICAgICBwdXNoWCA9IHN0YXJ0LnggPCB0aGlzLl92aWV3cG9ydE1hcmdpbiA/IHZpZXdwb3J0LmxlZnQgLSBzY3JvbGxQb3NpdGlvbi5sZWZ0IC0gc3RhcnQueCA6IDA7XG4gICAgfVxuXG4gICAgaWYgKG92ZXJsYXkuaGVpZ2h0IDw9IHZpZXdwb3J0LmhlaWdodCkge1xuICAgICAgcHVzaFkgPSBvdmVyZmxvd1RvcCB8fCAtb3ZlcmZsb3dCb3R0b207XG4gICAgfSBlbHNlIHtcbiAgICAgIHB1c2hZID0gc3RhcnQueSA8IHRoaXMuX3ZpZXdwb3J0TWFyZ2luID8gdmlld3BvcnQudG9wIC0gc2Nyb2xsUG9zaXRpb24udG9wIC0gc3RhcnQueSA6IDA7XG4gICAgfVxuXG4gICAgdGhpcy5fcHJldmlvdXNQdXNoQW1vdW50ID0geyB4OiBwdXNoWCwgeTogcHVzaFkgfTtcblxuICAgIHJldHVybiB7XG4gICAgICB4OiBzdGFydC54ICsgcHVzaFgsXG4gICAgICB5OiBzdGFydC55ICsgcHVzaFksXG4gICAgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBBcHBsaWVzIGEgY29tcHV0ZWQgcG9zaXRpb24gdG8gdGhlIG92ZXJsYXkgYW5kIGVtaXRzIGEgcG9zaXRpb24gY2hhbmdlLlxuICAgKiBAcGFyYW0gcG9zaXRpb24gVGhlIHBvc2l0aW9uIHByZWZlcmVuY2VcbiAgICogQHBhcmFtIG9yaWdpblBvaW50IFRoZSBwb2ludCBvbiB0aGUgb3JpZ2luIGVsZW1lbnQgd2hlcmUgdGhlIG92ZXJsYXkgaXMgY29ubmVjdGVkLlxuICAgKi9cbiAgcHJpdmF0ZSBfYXBwbHlQb3NpdGlvbihwb3NpdGlvbjogQ29ubmVjdGVkUG9zaXRpb24sIG9yaWdpblBvaW50OiBQb2ludCkge1xuICAgIHRoaXMuX3NldFRyYW5zZm9ybU9yaWdpbihwb3NpdGlvbik7XG4gICAgdGhpcy5fc2V0T3ZlcmxheUVsZW1lbnRTdHlsZXMob3JpZ2luUG9pbnQsIHBvc2l0aW9uKTtcbiAgICB0aGlzLl9zZXRCb3VuZGluZ0JveFN0eWxlcyhvcmlnaW5Qb2ludCwgcG9zaXRpb24pO1xuXG4gICAgaWYgKHBvc2l0aW9uLnBhbmVsQ2xhc3MpIHtcbiAgICAgIHRoaXMuX2FkZFBhbmVsQ2xhc3Nlcyhwb3NpdGlvbi5wYW5lbENsYXNzKTtcbiAgICB9XG5cbiAgICAvLyBTYXZlIHRoZSBsYXN0IGNvbm5lY3RlZCBwb3NpdGlvbiBpbiBjYXNlIHRoZSBwb3NpdGlvbiBuZWVkcyB0byBiZSByZS1jYWxjdWxhdGVkLlxuICAgIHRoaXMuX2xhc3RQb3NpdGlvbiA9IHBvc2l0aW9uO1xuXG4gICAgLy8gTm90aWZ5IHRoYXQgdGhlIHBvc2l0aW9uIGhhcyBiZWVuIGNoYW5nZWQgYWxvbmcgd2l0aCBpdHMgY2hhbmdlIHByb3BlcnRpZXMuXG4gICAgLy8gV2Ugb25seSBlbWl0IGlmIHdlJ3ZlIGdvdCBhbnkgc3Vic2NyaXB0aW9ucywgYmVjYXVzZSB0aGUgc2Nyb2xsIHZpc2liaWxpdHlcbiAgICAvLyBjYWxjdWxhdGlvbnMgY2FuIGJlIHNvbWV3aGF0IGV4cGVuc2l2ZS5cbiAgICBpZiAodGhpcy5fcG9zaXRpb25DaGFuZ2VzLm9ic2VydmVycy5sZW5ndGgpIHtcbiAgICAgIGNvbnN0IHNjcm9sbGFibGVWaWV3UHJvcGVydGllcyA9IHRoaXMuX2dldFNjcm9sbFZpc2liaWxpdHkoKTtcbiAgICAgIGNvbnN0IGNoYW5nZUV2ZW50ID0gbmV3IENvbm5lY3RlZE92ZXJsYXlQb3NpdGlvbkNoYW5nZShwb3NpdGlvbiwgc2Nyb2xsYWJsZVZpZXdQcm9wZXJ0aWVzKTtcbiAgICAgIHRoaXMuX3Bvc2l0aW9uQ2hhbmdlcy5uZXh0KGNoYW5nZUV2ZW50KTtcbiAgICB9XG5cbiAgICB0aGlzLl9pc0luaXRpYWxSZW5kZXIgPSBmYWxzZTtcbiAgfVxuXG4gIC8qKiBTZXRzIHRoZSB0cmFuc2Zvcm0gb3JpZ2luIGJhc2VkIG9uIHRoZSBjb25maWd1cmVkIHNlbGVjdG9yIGFuZCB0aGUgcGFzc2VkLWluIHBvc2l0aW9uLiAgKi9cbiAgcHJpdmF0ZSBfc2V0VHJhbnNmb3JtT3JpZ2luKHBvc2l0aW9uOiBDb25uZWN0ZWRQb3NpdGlvbikge1xuICAgIGlmICghdGhpcy5fdHJhbnNmb3JtT3JpZ2luU2VsZWN0b3IpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBlbGVtZW50czogTm9kZUxpc3RPZjxIVE1MRWxlbWVudD4gPSB0aGlzLl9ib3VuZGluZ0JveCEucXVlcnlTZWxlY3RvckFsbCh0aGlzLl90cmFuc2Zvcm1PcmlnaW5TZWxlY3Rvcik7XG4gICAgbGV0IHhPcmlnaW46ICdsZWZ0JyB8ICdyaWdodCcgfCAnY2VudGVyJztcbiAgICBsZXQgeU9yaWdpbjogJ3RvcCcgfCAnYm90dG9tJyB8ICdjZW50ZXInID0gcG9zaXRpb24ub3ZlcmxheVk7XG5cbiAgICBpZiAocG9zaXRpb24ub3ZlcmxheVggPT09ICdjZW50ZXInKSB7XG4gICAgICB4T3JpZ2luID0gJ2NlbnRlcic7XG4gICAgfSBlbHNlIGlmICh0aGlzLl9pc1J0bCgpKSB7XG4gICAgICB4T3JpZ2luID0gcG9zaXRpb24ub3ZlcmxheVggPT09ICdzdGFydCcgPyAncmlnaHQnIDogJ2xlZnQnO1xuICAgIH0gZWxzZSB7XG4gICAgICB4T3JpZ2luID0gcG9zaXRpb24ub3ZlcmxheVggPT09ICdzdGFydCcgPyAnbGVmdCcgOiAncmlnaHQnO1xuICAgIH1cblxuICAgIGZvciAobGV0IGkgPSAwOyBpIDwgZWxlbWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGVsZW1lbnRzW2ldLnN0eWxlLnRyYW5zZm9ybU9yaWdpbiA9IGAke3hPcmlnaW59ICR7eU9yaWdpbn1gO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBHZXRzIHRoZSBwb3NpdGlvbiBhbmQgc2l6ZSBvZiB0aGUgb3ZlcmxheSdzIHNpemluZyBjb250YWluZXIuXG4gICAqXG4gICAqIFRoaXMgbWV0aG9kIGRvZXMgbm8gbWVhc3VyaW5nIGFuZCBhcHBsaWVzIG5vIHN0eWxlcyBzbyB0aGF0IHdlIGNhbiBjaGVhcGx5IGNvbXB1dGUgdGhlXG4gICAqIGJvdW5kcyBmb3IgYWxsIHBvc2l0aW9ucyBhbmQgY2hvb3NlIHRoZSBiZXN0IGZpdCBiYXNlZCBvbiB0aGVzZSByZXN1bHRzLlxuICAgKi9cbiAgcHJpdmF0ZSBfY2FsY3VsYXRlQm91bmRpbmdCb3hSZWN0KG9yaWdpbjogUG9pbnQsIHBvc2l0aW9uOiBDb25uZWN0ZWRQb3NpdGlvbik6IEJvdW5kaW5nQm94UmVjdCB7XG4gICAgY29uc3Qgdmlld3BvcnQgPSB0aGlzLl92aWV3cG9ydFJlY3Q7XG4gICAgY29uc3QgaXNSdGwgPSB0aGlzLl9pc1J0bCgpO1xuICAgIGxldCBoZWlnaHQ6IG51bWJlciwgdG9wOiBudW1iZXIsIGJvdHRvbTogbnVtYmVyO1xuXG4gICAgaWYgKHBvc2l0aW9uLm92ZXJsYXlZID09PSAndG9wJykge1xuICAgICAgLy8gT3ZlcmxheSBpcyBvcGVuaW5nIFwiZG93bndhcmRcIiBhbmQgdGh1cyBpcyBib3VuZCBieSB0aGUgYm90dG9tIHZpZXdwb3J0IGVkZ2UuXG4gICAgICB0b3AgPSBvcmlnaW4ueTtcbiAgICAgIGhlaWdodCA9IHZpZXdwb3J0LmhlaWdodCAtIHRvcCArIHRoaXMuX3ZpZXdwb3J0TWFyZ2luO1xuICAgIH0gZWxzZSBpZiAocG9zaXRpb24ub3ZlcmxheVkgPT09ICdib3R0b20nKSB7XG4gICAgICAvLyBPdmVybGF5IGlzIG9wZW5pbmcgXCJ1cHdhcmRcIiBhbmQgdGh1cyBpcyBib3VuZCBieSB0aGUgdG9wIHZpZXdwb3J0IGVkZ2UuIFdlIG5lZWQgdG8gYWRkXG4gICAgICAvLyB0aGUgdmlld3BvcnQgbWFyZ2luIGJhY2sgaW4sIGJlY2F1c2UgdGhlIHZpZXdwb3J0IHJlY3QgaXMgbmFycm93ZWQgZG93biB0byByZW1vdmUgdGhlXG4gICAgICAvLyBtYXJnaW4sIHdoZXJlYXMgdGhlIGBvcmlnaW5gIHBvc2l0aW9uIGlzIGNhbGN1bGF0ZWQgYmFzZWQgb24gaXRzIGBET01SZWN0YC5cbiAgICAgIGJvdHRvbSA9IHZpZXdwb3J0LmhlaWdodCAtIG9yaWdpbi55ICsgdGhpcy5fdmlld3BvcnRNYXJnaW4gKiAyO1xuICAgICAgaGVpZ2h0ID0gdmlld3BvcnQuaGVpZ2h0IC0gYm90dG9tICsgdGhpcy5fdmlld3BvcnRNYXJnaW47XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElmIG5laXRoZXIgdG9wIG5vciBib3R0b20sIGl0IG1lYW5zIHRoYXQgdGhlIG92ZXJsYXkgaXMgdmVydGljYWxseSBjZW50ZXJlZCBvbiB0aGVcbiAgICAgIC8vIG9yaWdpbiBwb2ludC4gTm90ZSB0aGF0IHdlIHdhbnQgdGhlIHBvc2l0aW9uIHJlbGF0aXZlIHRvIHRoZSB2aWV3cG9ydCwgcmF0aGVyIHRoYW5cbiAgICAgIC8vIHRoZSBwYWdlLCB3aGljaCBpcyB3aHkgd2UgZG9uJ3QgdXNlIHNvbWV0aGluZyBsaWtlIGB2aWV3cG9ydC5ib3R0b20gLSBvcmlnaW4ueWAgYW5kXG4gICAgICAvLyBgb3JpZ2luLnkgLSB2aWV3cG9ydC50b3BgLlxuICAgICAgY29uc3Qgc21hbGxlc3REaXN0YW5jZVRvVmlld3BvcnRFZGdlID0gTWF0aC5taW4odmlld3BvcnQuYm90dG9tIC0gb3JpZ2luLnkgKyB2aWV3cG9ydC50b3AsIG9yaWdpbi55KTtcblxuICAgICAgY29uc3QgcHJldmlvdXNIZWlnaHQgPSB0aGlzLl9sYXN0Qm91bmRpbmdCb3hTaXplLmhlaWdodDtcblxuICAgICAgaGVpZ2h0ID0gc21hbGxlc3REaXN0YW5jZVRvVmlld3BvcnRFZGdlICogMjtcbiAgICAgIHRvcCA9IG9yaWdpbi55IC0gc21hbGxlc3REaXN0YW5jZVRvVmlld3BvcnRFZGdlO1xuXG4gICAgICBpZiAoaGVpZ2h0ID4gcHJldmlvdXNIZWlnaHQgJiYgIXRoaXMuX2lzSW5pdGlhbFJlbmRlciAmJiAhdGhpcy5fZ3Jvd0FmdGVyT3Blbikge1xuICAgICAgICB0b3AgPSBvcmlnaW4ueSAtIHByZXZpb3VzSGVpZ2h0IC8gMjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBUaGUgb3ZlcmxheSBpcyBvcGVuaW5nICdyaWdodC13YXJkJyAodGhlIGNvbnRlbnQgZmxvd3MgdG8gdGhlIHJpZ2h0KS5cbiAgICBjb25zdCBpc0JvdW5kZWRCeVJpZ2h0Vmlld3BvcnRFZGdlID1cbiAgICAgIChwb3NpdGlvbi5vdmVybGF5WCA9PT0gJ3N0YXJ0JyAmJiAhaXNSdGwpIHx8IChwb3NpdGlvbi5vdmVybGF5WCA9PT0gJ2VuZCcgJiYgaXNSdGwpO1xuXG4gICAgLy8gVGhlIG92ZXJsYXkgaXMgb3BlbmluZyAnbGVmdC13YXJkJyAodGhlIGNvbnRlbnQgZmxvd3MgdG8gdGhlIGxlZnQpLlxuICAgIGNvbnN0IGlzQm91bmRlZEJ5TGVmdFZpZXdwb3J0RWRnZSA9XG4gICAgICAocG9zaXRpb24ub3ZlcmxheVggPT09ICdlbmQnICYmICFpc1J0bCkgfHwgKHBvc2l0aW9uLm92ZXJsYXlYID09PSAnc3RhcnQnICYmIGlzUnRsKTtcblxuICAgIGxldCB3aWR0aDogbnVtYmVyLCBsZWZ0OiBudW1iZXIsIHJpZ2h0OiBudW1iZXI7XG5cbiAgICBpZiAoaXNCb3VuZGVkQnlMZWZ0Vmlld3BvcnRFZGdlKSB7XG4gICAgICByaWdodCA9IHZpZXdwb3J0LndpZHRoIC0gb3JpZ2luLnggKyB0aGlzLl92aWV3cG9ydE1hcmdpbjtcbiAgICAgIHdpZHRoID0gb3JpZ2luLnggLSB0aGlzLl92aWV3cG9ydE1hcmdpbjtcbiAgICB9IGVsc2UgaWYgKGlzQm91bmRlZEJ5UmlnaHRWaWV3cG9ydEVkZ2UpIHtcbiAgICAgIGxlZnQgPSBvcmlnaW4ueDtcbiAgICAgIHdpZHRoID0gdmlld3BvcnQucmlnaHQgLSBvcmlnaW4ueDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gSWYgbmVpdGhlciBzdGFydCBub3IgZW5kLCBpdCBtZWFucyB0aGF0IHRoZSBvdmVybGF5IGlzIGhvcml6b250YWxseSBjZW50ZXJlZCBvbiB0aGVcbiAgICAgIC8vIG9yaWdpbiBwb2ludC4gTm90ZSB0aGF0IHdlIHdhbnQgdGhlIHBvc2l0aW9uIHJlbGF0aXZlIHRvIHRoZSB2aWV3cG9ydCwgcmF0aGVyIHRoYW5cbiAgICAgIC8vIHRoZSBwYWdlLCB3aGljaCBpcyB3aHkgd2UgZG9uJ3QgdXNlIHNvbWV0aGluZyBsaWtlIGB2aWV3cG9ydC5yaWdodCAtIG9yaWdpbi54YCBhbmRcbiAgICAgIC8vIGBvcmlnaW4ueCAtIHZpZXdwb3J0LmxlZnRgLlxuICAgICAgY29uc3Qgc21hbGxlc3REaXN0YW5jZVRvVmlld3BvcnRFZGdlID0gTWF0aC5taW4odmlld3BvcnQucmlnaHQgLSBvcmlnaW4ueCArIHZpZXdwb3J0LmxlZnQsIG9yaWdpbi54KTtcbiAgICAgIGNvbnN0IHByZXZpb3VzV2lkdGggPSB0aGlzLl9sYXN0Qm91bmRpbmdCb3hTaXplLndpZHRoO1xuXG4gICAgICB3aWR0aCA9IHNtYWxsZXN0RGlzdGFuY2VUb1ZpZXdwb3J0RWRnZSAqIDI7XG4gICAgICBsZWZ0ID0gb3JpZ2luLnggLSBzbWFsbGVzdERpc3RhbmNlVG9WaWV3cG9ydEVkZ2U7XG5cbiAgICAgIGlmICh3aWR0aCA+IHByZXZpb3VzV2lkdGggJiYgIXRoaXMuX2lzSW5pdGlhbFJlbmRlciAmJiAhdGhpcy5fZ3Jvd0FmdGVyT3Blbikge1xuICAgICAgICBsZWZ0ID0gb3JpZ2luLnggLSBwcmV2aW91c1dpZHRoIC8gMjtcbiAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4geyB0b3A6IHRvcCEsIGxlZnQ6IGxlZnQhLCBib3R0b206IGJvdHRvbSEsIHJpZ2h0OiByaWdodCEsIHdpZHRoLCBoZWlnaHQgfTtcbiAgfVxuXG4gIC8qKlxuICAgKiBTZXRzIHRoZSBwb3NpdGlvbiBhbmQgc2l6ZSBvZiB0aGUgb3ZlcmxheSdzIHNpemluZyB3cmFwcGVyLiBUaGUgd3JhcHBlciBpcyBwb3NpdGlvbmVkIG9uIHRoZVxuICAgKiBvcmlnaW4ncyBjb25uZWN0aW9uIHBvaW50IGFuZCBzdHJldGNoZXMgdG8gdGhlIGJvdW5kcyBvZiB0aGUgdmlld3BvcnQuXG4gICAqXG4gICAqIEBwYXJhbSBvcmlnaW4gVGhlIHBvaW50IG9uIHRoZSBvcmlnaW4gZWxlbWVudCB3aGVyZSB0aGUgb3ZlcmxheSBpcyBjb25uZWN0ZWQuXG4gICAqIEBwYXJhbSBwb3NpdGlvbiBUaGUgcG9zaXRpb24gcHJlZmVyZW5jZVxuICAgKi9cbiAgcHJpdmF0ZSBfc2V0Qm91bmRpbmdCb3hTdHlsZXMob3JpZ2luOiBQb2ludCwgcG9zaXRpb246IENvbm5lY3RlZFBvc2l0aW9uKTogdm9pZCB7XG4gICAgY29uc3QgYm91bmRpbmdCb3hSZWN0ID0gdGhpcy5fY2FsY3VsYXRlQm91bmRpbmdCb3hSZWN0KG9yaWdpbiwgcG9zaXRpb24pO1xuXG4gICAgLy8gSXQncyB3ZWlyZCBpZiB0aGUgb3ZlcmxheSAqZ3Jvd3MqIHdoaWxlIHNjcm9sbGluZywgc28gd2UgdGFrZSB0aGUgbGFzdCBzaXplIGludG8gYWNjb3VudFxuICAgIC8vIHdoZW4gYXBwbHlpbmcgYSBuZXcgc2l6ZS5cbiAgICBpZiAoIXRoaXMuX2lzSW5pdGlhbFJlbmRlciAmJiAhdGhpcy5fZ3Jvd0FmdGVyT3Blbikge1xuICAgICAgYm91bmRpbmdCb3hSZWN0LmhlaWdodCA9IE1hdGgubWluKGJvdW5kaW5nQm94UmVjdC5oZWlnaHQsIHRoaXMuX2xhc3RCb3VuZGluZ0JveFNpemUuaGVpZ2h0KTtcbiAgICAgIGJvdW5kaW5nQm94UmVjdC53aWR0aCA9IE1hdGgubWluKGJvdW5kaW5nQm94UmVjdC53aWR0aCwgdGhpcy5fbGFzdEJvdW5kaW5nQm94U2l6ZS53aWR0aCk7XG4gICAgfVxuXG4gICAgY29uc3Qgc3R5bGVzID0ge30gYXMgQ1NTU3R5bGVEZWNsYXJhdGlvbjtcblxuICAgIGlmICh0aGlzLl9oYXNFeGFjdFBvc2l0aW9uKCkpIHtcbiAgICAgIHN0eWxlcy50b3AgPSBzdHlsZXMubGVmdCA9ICcwJztcbiAgICAgIHN0eWxlcy5ib3R0b20gPSBzdHlsZXMucmlnaHQgPSBzdHlsZXMubWF4SGVpZ2h0ID0gc3R5bGVzLm1heFdpZHRoID0gJyc7XG4gICAgICBzdHlsZXMud2lkdGggPSBzdHlsZXMuaGVpZ2h0ID0gJzEwMCUnO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBtYXhIZWlnaHQgPSB0aGlzLl9vdmVybGF5UmVmLmdldENvbmZpZygpLm1heEhlaWdodDtcbiAgICAgIGNvbnN0IG1heFdpZHRoID0gdGhpcy5fb3ZlcmxheVJlZi5nZXRDb25maWcoKS5tYXhXaWR0aDtcblxuICAgICAgc3R5bGVzLmhlaWdodCA9IGNvZXJjZUNzc1BpeGVsVmFsdWUoYm91bmRpbmdCb3hSZWN0LmhlaWdodCk7XG4gICAgICBzdHlsZXMudG9wID0gY29lcmNlQ3NzUGl4ZWxWYWx1ZShib3VuZGluZ0JveFJlY3QudG9wKTtcbiAgICAgIHN0eWxlcy5ib3R0b20gPSBjb2VyY2VDc3NQaXhlbFZhbHVlKGJvdW5kaW5nQm94UmVjdC5ib3R0b20pO1xuICAgICAgc3R5bGVzLndpZHRoID0gY29lcmNlQ3NzUGl4ZWxWYWx1ZShib3VuZGluZ0JveFJlY3Qud2lkdGgpO1xuICAgICAgc3R5bGVzLmxlZnQgPSBjb2VyY2VDc3NQaXhlbFZhbHVlKGJvdW5kaW5nQm94UmVjdC5sZWZ0KTtcbiAgICAgIHN0eWxlcy5yaWdodCA9IGNvZXJjZUNzc1BpeGVsVmFsdWUoYm91bmRpbmdCb3hSZWN0LnJpZ2h0KTtcblxuICAgICAgLy8gUHVzaCB0aGUgcGFuZSBjb250ZW50IHRvd2FyZHMgdGhlIHByb3BlciBkaXJlY3Rpb24uXG4gICAgICBpZiAocG9zaXRpb24ub3ZlcmxheVggPT09ICdjZW50ZXInKSB7XG4gICAgICAgIHN0eWxlcy5hbGlnbkl0ZW1zID0gJ2NlbnRlcic7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHlsZXMuYWxpZ25JdGVtcyA9IHBvc2l0aW9uLm92ZXJsYXlYID09PSAnZW5kJyA/ICdmbGV4LWVuZCcgOiAnZmxleC1zdGFydCc7XG4gICAgICB9XG5cbiAgICAgIGlmIChwb3NpdGlvbi5vdmVybGF5WSA9PT0gJ2NlbnRlcicpIHtcbiAgICAgICAgc3R5bGVzLmp1c3RpZnlDb250ZW50ID0gJ2NlbnRlcic7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdHlsZXMuanVzdGlmeUNvbnRlbnQgPSBwb3NpdGlvbi5vdmVybGF5WSA9PT0gJ2JvdHRvbScgPyAnZmxleC1lbmQnIDogJ2ZsZXgtc3RhcnQnO1xuICAgICAgfVxuXG4gICAgICBpZiAobWF4SGVpZ2h0KSB7XG4gICAgICAgIHN0eWxlcy5tYXhIZWlnaHQgPSBjb2VyY2VDc3NQaXhlbFZhbHVlKG1heEhlaWdodCk7XG4gICAgICB9XG5cbiAgICAgIGlmIChtYXhXaWR0aCkge1xuICAgICAgICBzdHlsZXMubWF4V2lkdGggPSBjb2VyY2VDc3NQaXhlbFZhbHVlKG1heFdpZHRoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB0aGlzLl9sYXN0Qm91bmRpbmdCb3hTaXplID0gYm91bmRpbmdCb3hSZWN0O1xuXG4gICAgZXh0ZW5kU3R5bGVzKHRoaXMuX2JvdW5kaW5nQm94IS5zdHlsZSwgc3R5bGVzKTtcbiAgfVxuXG4gIC8qKiBSZXNldHMgdGhlIHN0eWxlcyBmb3IgdGhlIGJvdW5kaW5nIGJveCBzbyB0aGF0IGEgbmV3IHBvc2l0aW9uaW5nIGNhbiBiZSBjb21wdXRlZC4gKi9cbiAgcHJpdmF0ZSBfcmVzZXRCb3VuZGluZ0JveFN0eWxlcygpIHtcbiAgICBleHRlbmRTdHlsZXModGhpcy5fYm91bmRpbmdCb3ghLnN0eWxlLCB7XG4gICAgICB0b3A6ICcwJyxcbiAgICAgIGxlZnQ6ICcwJyxcbiAgICAgIHJpZ2h0OiAnMCcsXG4gICAgICBib3R0b206ICcwJyxcbiAgICAgIGhlaWdodDogJycsXG4gICAgICB3aWR0aDogJycsXG4gICAgICBhbGlnbkl0ZW1zOiAnJyxcbiAgICAgIGp1c3RpZnlDb250ZW50OiAnJyxcbiAgICB9IGFzIENTU1N0eWxlRGVjbGFyYXRpb24pO1xuICB9XG5cbiAgLyoqIFJlc2V0cyB0aGUgc3R5bGVzIGZvciB0aGUgb3ZlcmxheSBwYW5lIHNvIHRoYXQgYSBuZXcgcG9zaXRpb25pbmcgY2FuIGJlIGNvbXB1dGVkLiAqL1xuICBwcml2YXRlIF9yZXNldE92ZXJsYXlFbGVtZW50U3R5bGVzKCkge1xuICAgIGV4dGVuZFN0eWxlcyh0aGlzLl9wYW5lLnN0eWxlLCB7XG4gICAgICB0b3A6ICcnLFxuICAgICAgbGVmdDogJycsXG4gICAgICBib3R0b206ICcnLFxuICAgICAgcmlnaHQ6ICcnLFxuICAgICAgcG9zaXRpb246ICcnLFxuICAgICAgdHJhbnNmb3JtOiAnJyxcbiAgICB9IGFzIENTU1N0eWxlRGVjbGFyYXRpb24pO1xuICB9XG5cbiAgLyoqIFNldHMgcG9zaXRpb25pbmcgc3R5bGVzIHRvIHRoZSBvdmVybGF5IGVsZW1lbnQuICovXG4gIHByaXZhdGUgX3NldE92ZXJsYXlFbGVtZW50U3R5bGVzKG9yaWdpblBvaW50OiBQb2ludCwgcG9zaXRpb246IENvbm5lY3RlZFBvc2l0aW9uKTogdm9pZCB7XG4gICAgY29uc3Qgc3R5bGVzID0ge30gYXMgQ1NTU3R5bGVEZWNsYXJhdGlvbjtcbiAgICBjb25zdCBoYXNFeGFjdFBvc2l0aW9uID0gdGhpcy5faGFzRXhhY3RQb3NpdGlvbigpO1xuICAgIGNvbnN0IGhhc0ZsZXhpYmxlRGltZW5zaW9ucyA9IHRoaXMuX2hhc0ZsZXhpYmxlRGltZW5zaW9ucztcbiAgICBjb25zdCBjb25maWcgPSB0aGlzLl9vdmVybGF5UmVmLmdldENvbmZpZygpO1xuXG4gICAgaWYgKGhhc0V4YWN0UG9zaXRpb24pIHtcbiAgICAgIGNvbnN0IHNjcm9sbFBvc2l0aW9uID0gdGhpcy5fdmlld3BvcnRSdWxlci5nZXRWaWV3cG9ydFNjcm9sbFBvc2l0aW9uKCk7XG4gICAgICBleHRlbmRTdHlsZXMoc3R5bGVzLCB0aGlzLl9nZXRFeGFjdE92ZXJsYXlZKHBvc2l0aW9uLCBvcmlnaW5Qb2ludCwgc2Nyb2xsUG9zaXRpb24pKTtcbiAgICAgIGV4dGVuZFN0eWxlcyhzdHlsZXMsIHRoaXMuX2dldEV4YWN0T3ZlcmxheVgocG9zaXRpb24sIG9yaWdpblBvaW50LCBzY3JvbGxQb3NpdGlvbikpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHlsZXMucG9zaXRpb24gPSAnc3RhdGljJztcbiAgICB9XG5cbiAgICAvLyBVc2UgYSB0cmFuc2Zvcm0gdG8gYXBwbHkgdGhlIG9mZnNldHMuIFdlIGRvIHRoaXMgYmVjYXVzZSB0aGUgYGNlbnRlcmAgcG9zaXRpb25zIHJlbHkgb25cbiAgICAvLyBiZWluZyBpbiB0aGUgbm9ybWFsIGZsZXggZmxvdyBhbmQgc2V0dGluZyBhIGB0b3BgIC8gYGxlZnRgIGF0IGFsbCB3aWxsIGNvbXBsZXRlbHkgdGhyb3dcbiAgICAvLyBvZmYgdGhlIHBvc2l0aW9uLiBXZSBhbHNvIGNhbid0IHVzZSBtYXJnaW5zLCBiZWNhdXNlIHRoZXkgd29uJ3QgaGF2ZSBhbiBlZmZlY3QgaW4gc29tZVxuICAgIC8vIGNhc2VzIHdoZXJlIHRoZSBlbGVtZW50IGRvZXNuJ3QgaGF2ZSBhbnl0aGluZyB0byBcInB1c2ggb2ZmIG9mXCIuIEZpbmFsbHksIHRoaXMgd29ya3NcbiAgICAvLyBiZXR0ZXIgYm90aCB3aXRoIGZsZXhpYmxlIGFuZCBub24tZmxleGlibGUgcG9zaXRpb25pbmcuXG4gICAgbGV0IHRyYW5zZm9ybVN0cmluZyA9ICcnO1xuICAgIGxldCBvZmZzZXRYID0gdGhpcy5fZ2V0T2Zmc2V0KHBvc2l0aW9uLCAneCcpO1xuICAgIGxldCBvZmZzZXRZID0gdGhpcy5fZ2V0T2Zmc2V0KHBvc2l0aW9uLCAneScpO1xuXG4gICAgaWYgKG9mZnNldFgpIHtcbiAgICAgIHRyYW5zZm9ybVN0cmluZyArPSBgdHJhbnNsYXRlWCgke29mZnNldFh9cHgpIGA7XG4gICAgfVxuXG4gICAgaWYgKG9mZnNldFkpIHtcbiAgICAgIHRyYW5zZm9ybVN0cmluZyArPSBgdHJhbnNsYXRlWSgke29mZnNldFl9cHgpYDtcbiAgICB9XG5cbiAgICBzdHlsZXMudHJhbnNmb3JtID0gdHJhbnNmb3JtU3RyaW5nLnRyaW0oKTtcblxuICAgIC8vIElmIGEgbWF4V2lkdGggb3IgbWF4SGVpZ2h0IGlzIHNwZWNpZmllZCBvbiB0aGUgb3ZlcmxheSwgd2UgcmVtb3ZlIHRoZW0uIFdlIGRvIHRoaXMgYmVjYXVzZVxuICAgIC8vIHdlIG5lZWQgdGhlc2UgdmFsdWVzIHRvIGJvdGggYmUgc2V0IHRvIFwiMTAwJVwiIGZvciB0aGUgYXV0b21hdGljIGZsZXhpYmxlIHNpemluZyB0byB3b3JrLlxuICAgIC8vIFRoZSBtYXhIZWlnaHQgYW5kIG1heFdpZHRoIGFyZSBzZXQgb24gdGhlIGJvdW5kaW5nQm94IGluIG9yZGVyIHRvIGVuZm9yY2UgdGhlIGNvbnN0cmFpbnQuXG4gICAgLy8gTm90ZSB0aGF0IHRoaXMgZG9lc24ndCBhcHBseSB3aGVuIHdlIGhhdmUgYW4gZXhhY3QgcG9zaXRpb24sIGluIHdoaWNoIGNhc2Ugd2UgZG8gd2FudCB0b1xuICAgIC8vIGFwcGx5IHRoZW0gYmVjYXVzZSB0aGV5J2xsIGJlIGNsZWFyZWQgZnJvbSB0aGUgYm91bmRpbmcgYm94LlxuICAgIGlmIChjb25maWcubWF4SGVpZ2h0KSB7XG4gICAgICBpZiAoaGFzRXhhY3RQb3NpdGlvbikge1xuICAgICAgICBzdHlsZXMubWF4SGVpZ2h0ID0gY29lcmNlQ3NzUGl4ZWxWYWx1ZShjb25maWcubWF4SGVpZ2h0KTtcbiAgICAgIH0gZWxzZSBpZiAoaGFzRmxleGlibGVEaW1lbnNpb25zKSB7XG4gICAgICAgIHN0eWxlcy5tYXhIZWlnaHQgPSAnJztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAoY29uZmlnLm1heFdpZHRoKSB7XG4gICAgICBpZiAoaGFzRXhhY3RQb3NpdGlvbikge1xuICAgICAgICBzdHlsZXMubWF4V2lkdGggPSBjb2VyY2VDc3NQaXhlbFZhbHVlKGNvbmZpZy5tYXhXaWR0aCk7XG4gICAgICB9IGVsc2UgaWYgKGhhc0ZsZXhpYmxlRGltZW5zaW9ucykge1xuICAgICAgICBzdHlsZXMubWF4V2lkdGggPSAnJztcbiAgICAgIH1cbiAgICB9XG5cbiAgICBleHRlbmRTdHlsZXModGhpcy5fcGFuZS5zdHlsZSwgc3R5bGVzKTtcbiAgfVxuXG4gIC8qKiBHZXRzIHRoZSBleGFjdCB0b3AvYm90dG9tIGZvciB0aGUgb3ZlcmxheSB3aGVuIG5vdCB1c2luZyBmbGV4aWJsZSBzaXppbmcgb3Igd2hlbiBwdXNoaW5nLiAqL1xuICBwcml2YXRlIF9nZXRFeGFjdE92ZXJsYXlZKHBvc2l0aW9uOiBDb25uZWN0ZWRQb3NpdGlvbiwgb3JpZ2luUG9pbnQ6IFBvaW50LCBzY3JvbGxQb3NpdGlvbjogVmlld3BvcnRTY3JvbGxQb3NpdGlvbikge1xuICAgIC8vIFJlc2V0IGFueSBleGlzdGluZyBzdHlsZXMuIFRoaXMgaXMgbmVjZXNzYXJ5IGluIGNhc2UgdGhlXG4gICAgLy8gcHJlZmVycmVkIHBvc2l0aW9uIGhhcyBjaGFuZ2VkIHNpbmNlIHRoZSBsYXN0IGBhcHBseWAuXG4gICAgbGV0IHN0eWxlcyA9IHsgdG9wOiAnJywgYm90dG9tOiAnJyB9IGFzIENTU1N0eWxlRGVjbGFyYXRpb247XG4gICAgbGV0IG92ZXJsYXlQb2ludCA9IHRoaXMuX2dldE92ZXJsYXlQb2ludChvcmlnaW5Qb2ludCwgdGhpcy5fb3ZlcmxheVJlY3QsIHBvc2l0aW9uKTtcblxuICAgIGlmICh0aGlzLl9pc1B1c2hlZCkge1xuICAgICAgb3ZlcmxheVBvaW50ID0gdGhpcy5fcHVzaE92ZXJsYXlPblNjcmVlbihvdmVybGF5UG9pbnQsIHRoaXMuX292ZXJsYXlSZWN0LCBzY3JvbGxQb3NpdGlvbik7XG4gICAgfVxuXG4gICAgLy8gV2Ugd2FudCB0byBzZXQgZWl0aGVyIGB0b3BgIG9yIGBib3R0b21gIGJhc2VkIG9uIHdoZXRoZXIgdGhlIG92ZXJsYXkgd2FudHMgdG8gYXBwZWFyXG4gICAgLy8gYWJvdmUgb3IgYmVsb3cgdGhlIG9yaWdpbiBhbmQgdGhlIGRpcmVjdGlvbiBpbiB3aGljaCB0aGUgZWxlbWVudCB3aWxsIGV4cGFuZC5cbiAgICBpZiAocG9zaXRpb24ub3ZlcmxheVkgPT09ICdib3R0b20nKSB7XG4gICAgICAvLyBXaGVuIHVzaW5nIGBib3R0b21gLCB3ZSBhZGp1c3QgdGhlIHkgcG9zaXRpb24gc3VjaCB0aGF0IGl0IGlzIHRoZSBkaXN0YW5jZVxuICAgICAgLy8gZnJvbSB0aGUgYm90dG9tIG9mIHRoZSB2aWV3cG9ydCByYXRoZXIgdGhhbiB0aGUgdG9wLlxuICAgICAgY29uc3QgZG9jdW1lbnRIZWlnaHQgPSB0aGlzLl9kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQhLmNsaWVudEhlaWdodDtcbiAgICAgIHN0eWxlcy5ib3R0b20gPSBgJHtkb2N1bWVudEhlaWdodCAtIChvdmVybGF5UG9pbnQueSArIHRoaXMuX292ZXJsYXlSZWN0LmhlaWdodCl9cHhgO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdHlsZXMudG9wID0gY29lcmNlQ3NzUGl4ZWxWYWx1ZShvdmVybGF5UG9pbnQueSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHN0eWxlcztcbiAgfVxuXG4gIC8qKiBHZXRzIHRoZSBleGFjdCBsZWZ0L3JpZ2h0IGZvciB0aGUgb3ZlcmxheSB3aGVuIG5vdCB1c2luZyBmbGV4aWJsZSBzaXppbmcgb3Igd2hlbiBwdXNoaW5nLiAqL1xuICBwcml2YXRlIF9nZXRFeGFjdE92ZXJsYXlYKHBvc2l0aW9uOiBDb25uZWN0ZWRQb3NpdGlvbiwgb3JpZ2luUG9pbnQ6IFBvaW50LCBzY3JvbGxQb3NpdGlvbjogVmlld3BvcnRTY3JvbGxQb3NpdGlvbikge1xuICAgIC8vIFJlc2V0IGFueSBleGlzdGluZyBzdHlsZXMuIFRoaXMgaXMgbmVjZXNzYXJ5IGluIGNhc2UgdGhlIHByZWZlcnJlZCBwb3NpdGlvbiBoYXNcbiAgICAvLyBjaGFuZ2VkIHNpbmNlIHRoZSBsYXN0IGBhcHBseWAuXG4gICAgbGV0IHN0eWxlcyA9IHsgbGVmdDogJycsIHJpZ2h0OiAnJyB9IGFzIENTU1N0eWxlRGVjbGFyYXRpb247XG4gICAgbGV0IG92ZXJsYXlQb2ludCA9IHRoaXMuX2dldE92ZXJsYXlQb2ludChvcmlnaW5Qb2ludCwgdGhpcy5fb3ZlcmxheVJlY3QsIHBvc2l0aW9uKTtcblxuICAgIGlmICh0aGlzLl9pc1B1c2hlZCkge1xuICAgICAgb3ZlcmxheVBvaW50ID0gdGhpcy5fcHVzaE92ZXJsYXlPblNjcmVlbihvdmVybGF5UG9pbnQsIHRoaXMuX292ZXJsYXlSZWN0LCBzY3JvbGxQb3NpdGlvbik7XG4gICAgfVxuXG4gICAgLy8gV2Ugd2FudCB0byBzZXQgZWl0aGVyIGBsZWZ0YCBvciBgcmlnaHRgIGJhc2VkIG9uIHdoZXRoZXIgdGhlIG92ZXJsYXkgd2FudHMgdG8gYXBwZWFyIFwiYmVmb3JlXCJcbiAgICAvLyBvciBcImFmdGVyXCIgdGhlIG9yaWdpbiwgd2hpY2ggZGV0ZXJtaW5lcyB0aGUgZGlyZWN0aW9uIGluIHdoaWNoIHRoZSBlbGVtZW50IHdpbGwgZXhwYW5kLlxuICAgIC8vIEZvciB0aGUgaG9yaXpvbnRhbCBheGlzLCB0aGUgbWVhbmluZyBvZiBcImJlZm9yZVwiIGFuZCBcImFmdGVyXCIgY2hhbmdlIGJhc2VkIG9uIHdoZXRoZXIgdGhlXG4gICAgLy8gcGFnZSBpcyBpbiBSVEwgb3IgTFRSLlxuICAgIGxldCBob3Jpem9udGFsU3R5bGVQcm9wZXJ0eTogJ2xlZnQnIHwgJ3JpZ2h0JztcblxuICAgIGlmICh0aGlzLl9pc1J0bCgpKSB7XG4gICAgICBob3Jpem9udGFsU3R5bGVQcm9wZXJ0eSA9IHBvc2l0aW9uLm92ZXJsYXlYID09PSAnZW5kJyA/ICdsZWZ0JyA6ICdyaWdodCc7XG4gICAgfSBlbHNlIHtcbiAgICAgIGhvcml6b250YWxTdHlsZVByb3BlcnR5ID0gcG9zaXRpb24ub3ZlcmxheVggPT09ICdlbmQnID8gJ3JpZ2h0JyA6ICdsZWZ0JztcbiAgICB9XG5cbiAgICAvLyBXaGVuIHdlJ3JlIHNldHRpbmcgYHJpZ2h0YCwgd2UgYWRqdXN0IHRoZSB4IHBvc2l0aW9uIHN1Y2ggdGhhdCBpdCBpcyB0aGUgZGlzdGFuY2VcbiAgICAvLyBmcm9tIHRoZSByaWdodCBlZGdlIG9mIHRoZSB2aWV3cG9ydCByYXRoZXIgdGhhbiB0aGUgbGVmdCBlZGdlLlxuICAgIGlmIChob3Jpem9udGFsU3R5bGVQcm9wZXJ0eSA9PT0gJ3JpZ2h0Jykge1xuICAgICAgY29uc3QgZG9jdW1lbnRXaWR0aCA9IHRoaXMuX2RvY3VtZW50LmRvY3VtZW50RWxlbWVudCEuY2xpZW50V2lkdGg7XG4gICAgICBzdHlsZXMucmlnaHQgPSBgJHtkb2N1bWVudFdpZHRoIC0gKG92ZXJsYXlQb2ludC54ICsgdGhpcy5fb3ZlcmxheVJlY3Qud2lkdGgpfXB4YDtcbiAgICB9IGVsc2Uge1xuICAgICAgc3R5bGVzLmxlZnQgPSBjb2VyY2VDc3NQaXhlbFZhbHVlKG92ZXJsYXlQb2ludC54KTtcbiAgICB9XG5cbiAgICByZXR1cm4gc3R5bGVzO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldHMgdGhlIHZpZXcgcHJvcGVydGllcyBvZiB0aGUgdHJpZ2dlciBhbmQgb3ZlcmxheSwgaW5jbHVkaW5nIHdoZXRoZXIgdGhleSBhcmUgY2xpcHBlZFxuICAgKiBvciBjb21wbGV0ZWx5IG91dHNpZGUgdGhlIHZpZXcgb2YgYW55IG9mIHRoZSBzdHJhdGVneSdzIHNjcm9sbGFibGVzLlxuICAgKi9cbiAgcHJpdmF0ZSBfZ2V0U2Nyb2xsVmlzaWJpbGl0eSgpOiBTY3JvbGxpbmdWaXNpYmlsaXR5IHtcbiAgICAvLyBOb3RlOiBuZWVkcyBmcmVzaCByZWN0cyBzaW5jZSB0aGUgcG9zaXRpb24gY291bGQndmUgY2hhbmdlZC5cbiAgICBjb25zdCBvcmlnaW5Cb3VuZHMgPSB0aGlzLl9nZXRPcmlnaW5SZWN0KCk7XG4gICAgY29uc3Qgb3ZlcmxheUJvdW5kcyA9IHRoaXMuX3BhbmUuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cbiAgICAvLyBUT0RPKGplbGJvdXJuKTogaW5zdGVhZCBvZiBuZWVkaW5nIGFsbCBvZiB0aGUgY2xpZW50IHJlY3RzIGZvciB0aGVzZSBzY3JvbGxpbmcgY29udGFpbmVyc1xuICAgIC8vIGV2ZXJ5IHRpbWUsIHdlIHNob3VsZCBiZSBhYmxlIHRvIHVzZSB0aGUgc2Nyb2xsVG9wIG9mIHRoZSBjb250YWluZXJzIGlmIHRoZSBzaXplIG9mIHRob3NlXG4gICAgLy8gY29udGFpbmVycyBoYXNuJ3QgY2hhbmdlZC5cbiAgICBjb25zdCBzY3JvbGxDb250YWluZXJCb3VuZHMgPSB0aGlzLl9zY3JvbGxhYmxlcy5tYXAoc2Nyb2xsYWJsZSA9PiB7XG4gICAgICByZXR1cm4gc2Nyb2xsYWJsZS5nZXRFbGVtZW50UmVmKCkubmF0aXZlRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB9KTtcblxuICAgIHJldHVybiB7XG4gICAgICBpc09yaWdpbkNsaXBwZWQ6IGlzRWxlbWVudENsaXBwZWRCeVNjcm9sbGluZyhvcmlnaW5Cb3VuZHMsIHNjcm9sbENvbnRhaW5lckJvdW5kcyksXG4gICAgICBpc09yaWdpbk91dHNpZGVWaWV3OiBpc0VsZW1lbnRTY3JvbGxlZE91dHNpZGVWaWV3KG9yaWdpbkJvdW5kcywgc2Nyb2xsQ29udGFpbmVyQm91bmRzKSxcbiAgICAgIGlzT3ZlcmxheUNsaXBwZWQ6IGlzRWxlbWVudENsaXBwZWRCeVNjcm9sbGluZyhvdmVybGF5Qm91bmRzLCBzY3JvbGxDb250YWluZXJCb3VuZHMpLFxuICAgICAgaXNPdmVybGF5T3V0c2lkZVZpZXc6IGlzRWxlbWVudFNjcm9sbGVkT3V0c2lkZVZpZXcob3ZlcmxheUJvdW5kcywgc2Nyb2xsQ29udGFpbmVyQm91bmRzKSxcbiAgICB9O1xuICB9XG5cbiAgLyoqIFN1YnRyYWN0cyB0aGUgYW1vdW50IHRoYXQgYW4gZWxlbWVudCBpcyBvdmVyZmxvd2luZyBvbiBhbiBheGlzIGZyb20gaXRzIGxlbmd0aC4gKi9cbiAgcHJpdmF0ZSBfc3VidHJhY3RPdmVyZmxvd3MobGVuZ3RoOiBudW1iZXIsIC4uLm92ZXJmbG93czogbnVtYmVyW10pOiBudW1iZXIge1xuICAgIHJldHVybiBvdmVyZmxvd3MucmVkdWNlKChjdXJyZW50VmFsdWU6IG51bWJlciwgY3VycmVudE92ZXJmbG93OiBudW1iZXIpID0+IHtcbiAgICAgIHJldHVybiBjdXJyZW50VmFsdWUgLSBNYXRoLm1heChjdXJyZW50T3ZlcmZsb3csIDApO1xuICAgIH0sIGxlbmd0aCk7XG4gIH1cblxuICAvKiogTmFycm93cyB0aGUgZ2l2ZW4gdmlld3BvcnQgcmVjdCBieSB0aGUgY3VycmVudCBfdmlld3BvcnRNYXJnaW4uICovXG4gIHByaXZhdGUgX2dldE5hcnJvd2VkVmlld3BvcnRSZWN0KCk6IERpbWVuc2lvbnMge1xuICAgIC8vIFdlIHJlY2FsY3VsYXRlIHRoZSB2aWV3cG9ydCByZWN0IGhlcmUgb3Vyc2VsdmVzLCByYXRoZXIgdGhhbiB1c2luZyB0aGUgVmlld3BvcnRSdWxlcixcbiAgICAvLyBiZWNhdXNlIHdlIHdhbnQgdG8gdXNlIHRoZSBgY2xpZW50V2lkdGhgIGFuZCBgY2xpZW50SGVpZ2h0YCBhcyB0aGUgYmFzZS4gVGhlIGRpZmZlcmVuY2VcbiAgICAvLyBiZWluZyB0aGF0IHRoZSBjbGllbnQgcHJvcGVydGllcyBkb24ndCBpbmNsdWRlIHRoZSBzY3JvbGxiYXIsIGFzIG9wcG9zZWQgdG8gYGlubmVyV2lkdGhgXG4gICAgLy8gYW5kIGBpbm5lckhlaWdodGAgdGhhdCBkby4gVGhpcyBpcyBuZWNlc3NhcnksIGJlY2F1c2UgdGhlIG92ZXJsYXkgY29udGFpbmVyIHVzZXNcbiAgICAvLyAxMDAlIGB3aWR0aGAgYW5kIGBoZWlnaHRgIHdoaWNoIGRvbid0IGluY2x1ZGUgdGhlIHNjcm9sbGJhciBlaXRoZXIuXG4gICAgY29uc3Qgd2lkdGggPSB0aGlzLl9kb2N1bWVudC5kb2N1bWVudEVsZW1lbnQhLmNsaWVudFdpZHRoO1xuICAgIGNvbnN0IGhlaWdodCA9IHRoaXMuX2RvY3VtZW50LmRvY3VtZW50RWxlbWVudCEuY2xpZW50SGVpZ2h0O1xuICAgIGNvbnN0IHNjcm9sbFBvc2l0aW9uID0gdGhpcy5fdmlld3BvcnRSdWxlci5nZXRWaWV3cG9ydFNjcm9sbFBvc2l0aW9uKCk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgdG9wOiBzY3JvbGxQb3NpdGlvbi50b3AgKyB0aGlzLl92aWV3cG9ydE1hcmdpbixcbiAgICAgIGxlZnQ6IHNjcm9sbFBvc2l0aW9uLmxlZnQgKyB0aGlzLl92aWV3cG9ydE1hcmdpbixcbiAgICAgIHJpZ2h0OiBzY3JvbGxQb3NpdGlvbi5sZWZ0ICsgd2lkdGggLSB0aGlzLl92aWV3cG9ydE1hcmdpbixcbiAgICAgIGJvdHRvbTogc2Nyb2xsUG9zaXRpb24udG9wICsgaGVpZ2h0IC0gdGhpcy5fdmlld3BvcnRNYXJnaW4sXG4gICAgICB3aWR0aDogd2lkdGggLSAyICogdGhpcy5fdmlld3BvcnRNYXJnaW4sXG4gICAgICBoZWlnaHQ6IGhlaWdodCAtIDIgKiB0aGlzLl92aWV3cG9ydE1hcmdpbixcbiAgICB9O1xuICB9XG5cbiAgLyoqIFdoZXRoZXIgdGhlIHdlJ3JlIGRlYWxpbmcgd2l0aCBhbiBSVEwgY29udGV4dCAqL1xuICBwcml2YXRlIF9pc1J0bCgpIHtcbiAgICByZXR1cm4gdGhpcy5fb3ZlcmxheVJlZi5nZXREaXJlY3Rpb24oKSA9PT0gJ3J0bCc7XG4gIH1cblxuICAvKiogRGV0ZXJtaW5lcyB3aGV0aGVyIHRoZSBvdmVybGF5IHVzZXMgZXhhY3Qgb3IgZmxleGlibGUgcG9zaXRpb25pbmcuICovXG4gIHByaXZhdGUgX2hhc0V4YWN0UG9zaXRpb24oKSB7XG4gICAgcmV0dXJuICF0aGlzLl9oYXNGbGV4aWJsZURpbWVuc2lvbnMgfHwgdGhpcy5faXNQdXNoZWQ7XG4gIH1cblxuICAvKiogUmV0cmlldmVzIHRoZSBvZmZzZXQgb2YgYSBwb3NpdGlvbiBhbG9uZyB0aGUgeCBvciB5IGF4aXMuICovXG4gIHByaXZhdGUgX2dldE9mZnNldChwb3NpdGlvbjogQ29ubmVjdGVkUG9zaXRpb24sIGF4aXM6ICd4JyB8ICd5Jykge1xuICAgIGlmIChheGlzID09PSAneCcpIHtcbiAgICAgIC8vIFdlIGRvbid0IGRvIHNvbWV0aGluZyBsaWtlIGBwb3NpdGlvblsnb2Zmc2V0JyArIGF4aXNdYCBpblxuICAgICAgLy8gb3JkZXIgdG8gYXZvaWQgYnJlYWtpbmcgbWluaWZpZXJzIHRoYXQgcmVuYW1lIHByb3BlcnRpZXMuXG4gICAgICByZXR1cm4gcG9zaXRpb24ub2Zmc2V0WCA9PSBudWxsID8gdGhpcy5fb2Zmc2V0WCA6IHBvc2l0aW9uLm9mZnNldFg7XG4gICAgfVxuXG4gICAgcmV0dXJuIHBvc2l0aW9uLm9mZnNldFkgPT0gbnVsbCA/IHRoaXMuX29mZnNldFkgOiBwb3NpdGlvbi5vZmZzZXRZO1xuICB9XG5cbiAgLyoqIFZhbGlkYXRlcyB0aGF0IHRoZSBjdXJyZW50IHBvc2l0aW9uIG1hdGNoIHRoZSBleHBlY3RlZCB2YWx1ZXMuICovXG4gIHByaXZhdGUgX3ZhbGlkYXRlUG9zaXRpb25zKCk6IHZvaWQge1xuICAgIGlmICh0cnVlKSB7XG4gICAgICBpZiAoIXRoaXMuX3ByZWZlcnJlZFBvc2l0aW9ucy5sZW5ndGgpIHtcbiAgICAgICAgdGhyb3cgRXJyb3IoJ0ZsZXhpYmxlQ29ubmVjdGVkUG9zaXRpb25TdHJhdGVneTogQXQgbGVhc3Qgb25lIHBvc2l0aW9uIGlzIHJlcXVpcmVkLicpO1xuICAgICAgfVxuXG4gICAgICAvLyBUT0RPKGNyaXNiZXRvKTogcmVtb3ZlIHRoZXNlIG9uY2UgQW5ndWxhcidzIHRlbXBsYXRlIHR5cGVcbiAgICAgIC8vIGNoZWNraW5nIGlzIGFkdmFuY2VkIGVub3VnaCB0byBjYXRjaCB0aGVzZSBjYXNlcy5cbiAgICAgIHRoaXMuX3ByZWZlcnJlZFBvc2l0aW9ucy5mb3JFYWNoKHBhaXIgPT4ge1xuICAgICAgICB2YWxpZGF0ZUhvcml6b250YWxQb3NpdGlvbignb3JpZ2luWCcsIHBhaXIub3JpZ2luWCk7XG4gICAgICAgIHZhbGlkYXRlVmVydGljYWxQb3NpdGlvbignb3JpZ2luWScsIHBhaXIub3JpZ2luWSk7XG4gICAgICAgIHZhbGlkYXRlSG9yaXpvbnRhbFBvc2l0aW9uKCdvdmVybGF5WCcsIHBhaXIub3ZlcmxheVgpO1xuICAgICAgICB2YWxpZGF0ZVZlcnRpY2FsUG9zaXRpb24oJ292ZXJsYXlZJywgcGFpci5vdmVybGF5WSk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKiogQWRkcyBhIHNpbmdsZSBDU1MgY2xhc3Mgb3IgYW4gYXJyYXkgb2YgY2xhc3NlcyBvbiB0aGUgb3ZlcmxheSBwYW5lbC4gKi9cbiAgcHJpdmF0ZSBfYWRkUGFuZWxDbGFzc2VzKGNzc0NsYXNzZXM6IHN0cmluZyB8IHN0cmluZ1tdKSB7XG4gICAgaWYgKHRoaXMuX3BhbmUpIHtcbiAgICAgIGNvZXJjZUFycmF5KGNzc0NsYXNzZXMpLmZvckVhY2goY3NzQ2xhc3MgPT4ge1xuICAgICAgICBpZiAoY3NzQ2xhc3MgIT09ICcnICYmIHRoaXMuX2FwcGxpZWRQYW5lbENsYXNzZXMuaW5kZXhPZihjc3NDbGFzcykgPT09IC0xKSB7XG4gICAgICAgICAgdGhpcy5fYXBwbGllZFBhbmVsQ2xhc3Nlcy5wdXNoKGNzc0NsYXNzKTtcbiAgICAgICAgICB0aGlzLl9wYW5lLmNsYXNzTGlzdC5hZGQoY3NzQ2xhc3MpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG4gIH1cblxuICAvKiogQ2xlYXJzIHRoZSBjbGFzc2VzIHRoYXQgdGhlIHBvc2l0aW9uIHN0cmF0ZWd5IGhhcyBhcHBsaWVkIGZyb20gdGhlIG92ZXJsYXkgcGFuZWwuICovXG4gIHByaXZhdGUgX2NsZWFyUGFuZWxDbGFzc2VzKCkge1xuICAgIGlmICh0aGlzLl9wYW5lKSB7XG4gICAgICB0aGlzLl9hcHBsaWVkUGFuZWxDbGFzc2VzLmZvckVhY2goY3NzQ2xhc3MgPT4ge1xuICAgICAgICB0aGlzLl9wYW5lLmNsYXNzTGlzdC5yZW1vdmUoY3NzQ2xhc3MpO1xuICAgICAgfSk7XG4gICAgICB0aGlzLl9hcHBsaWVkUGFuZWxDbGFzc2VzID0gW107XG4gICAgfVxuICB9XG5cbiAgLyoqIFJldHVybnMgdGhlIERPTVJlY3Qgb2YgdGhlIGN1cnJlbnQgb3JpZ2luLiAqL1xuICBwcml2YXRlIF9nZXRPcmlnaW5SZWN0KCk6IERpbWVuc2lvbnMge1xuICAgIGNvbnN0IG9yaWdpbiA9IHRoaXMuX29yaWdpbjtcblxuICAgIGlmIChvcmlnaW4gaW5zdGFuY2VvZiBFbGVtZW50UmVmKSB7XG4gICAgICByZXR1cm4gb3JpZ2luLm5hdGl2ZUVsZW1lbnQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgfVxuXG4gICAgLy8gQ2hlY2sgZm9yIEVsZW1lbnQgc28gU1ZHIGVsZW1lbnRzIGFyZSBhbHNvIHN1cHBvcnRlZC5cbiAgICBpZiAob3JpZ2luIGluc3RhbmNlb2YgRWxlbWVudCkge1xuICAgICAgcmV0dXJuIG9yaWdpbi5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcbiAgICB9XG5cbiAgICBjb25zdCB3aWR0aCA9IG9yaWdpbi53aWR0aCB8fCAwO1xuICAgIGNvbnN0IGhlaWdodCA9IG9yaWdpbi5oZWlnaHQgfHwgMDtcblxuICAgIC8vIElmIHRoZSBvcmlnaW4gaXMgYSBwb2ludCwgcmV0dXJuIGEgY2xpZW50IHJlY3QgYXMgaWYgaXQgd2FzIGEgMHgwIGVsZW1lbnQgYXQgdGhlIHBvaW50LlxuICAgIHJldHVybiB7XG4gICAgICB0b3A6IG9yaWdpbi55LFxuICAgICAgYm90dG9tOiBvcmlnaW4ueSArIGhlaWdodCxcbiAgICAgIGxlZnQ6IG9yaWdpbi54LFxuICAgICAgcmlnaHQ6IG9yaWdpbi54ICsgd2lkdGgsXG4gICAgICBoZWlnaHQsXG4gICAgICB3aWR0aCxcbiAgICB9O1xuICB9XG59XG5cbi8qKiBBIHNpbXBsZSAoeCwgeSkgY29vcmRpbmF0ZS4gKi9cbmludGVyZmFjZSBQb2ludCB7XG4gIHg6IG51bWJlcjtcbiAgeTogbnVtYmVyO1xufVxuXG4vKiogUmVjb3JkIG9mIG1lYXN1cmVtZW50cyBmb3IgaG93IGFuIG92ZXJsYXkgKGF0IGEgZ2l2ZW4gcG9zaXRpb24pIGZpdHMgaW50byB0aGUgdmlld3BvcnQuICovXG5pbnRlcmZhY2UgT3ZlcmxheUZpdCB7XG4gIC8qKiBXaGV0aGVyIHRoZSBvdmVybGF5IGZpdHMgY29tcGxldGVseSBpbiB0aGUgdmlld3BvcnQuICovXG4gIGlzQ29tcGxldGVseVdpdGhpblZpZXdwb3J0OiBib29sZWFuO1xuXG4gIC8qKiBXaGV0aGVyIHRoZSBvdmVybGF5IGZpdHMgaW4gdGhlIHZpZXdwb3J0IG9uIHRoZSB5LWF4aXMuICovXG4gIGZpdHNJblZpZXdwb3J0VmVydGljYWxseTogYm9vbGVhbjtcblxuICAvKiogV2hldGhlciB0aGUgb3ZlcmxheSBmaXRzIGluIHRoZSB2aWV3cG9ydCBvbiB0aGUgeC1heGlzLiAqL1xuICBmaXRzSW5WaWV3cG9ydEhvcml6b250YWxseTogYm9vbGVhbjtcblxuICAvKiogVGhlIHRvdGFsIHZpc2libGUgYXJlYSAoaW4gcHheMikgb2YgdGhlIG92ZXJsYXkgaW5zaWRlIHRoZSB2aWV3cG9ydC4gKi9cbiAgdmlzaWJsZUFyZWE6IG51bWJlcjtcbn1cblxuLyoqIFJlY29yZCBvZiB0aGUgbWVhc3VyZW1lbnRzIGRldGVybWluaW5nIHdoZXRoZXIgYW4gb3ZlcmxheSB3aWxsIGZpdCBpbiBhIHNwZWNpZmljIHBvc2l0aW9uLiAqL1xuaW50ZXJmYWNlIEZhbGxiYWNrUG9zaXRpb24ge1xuICBwb3NpdGlvbjogQ29ubmVjdGVkUG9zaXRpb247XG4gIG9yaWdpblBvaW50OiBQb2ludDtcbiAgb3ZlcmxheVBvaW50OiBQb2ludDtcbiAgb3ZlcmxheUZpdDogT3ZlcmxheUZpdDtcbiAgb3ZlcmxheVJlY3Q6IERpbWVuc2lvbnM7XG59XG5cbi8qKiBQb3NpdGlvbiBhbmQgc2l6ZSBvZiB0aGUgb3ZlcmxheSBzaXppbmcgd3JhcHBlciBmb3IgYSBzcGVjaWZpYyBwb3NpdGlvbi4gKi9cbmludGVyZmFjZSBCb3VuZGluZ0JveFJlY3Qge1xuICB0b3A6IG51bWJlcjtcbiAgbGVmdDogbnVtYmVyO1xuICBib3R0b206IG51bWJlcjtcbiAgcmlnaHQ6IG51bWJlcjtcbiAgaGVpZ2h0OiBudW1iZXI7XG4gIHdpZHRoOiBudW1iZXI7XG59XG5cbi8qKiBSZWNvcmQgb2YgbWVhc3VyZXMgZGV0ZXJtaW5pbmcgaG93IHdlbGwgYSBnaXZlbiBwb3NpdGlvbiB3aWxsIGZpdCB3aXRoIGZsZXhpYmxlIGRpbWVuc2lvbnMuICovXG5pbnRlcmZhY2UgRmxleGlibGVGaXQge1xuICBwb3NpdGlvbjogQ29ubmVjdGVkUG9zaXRpb247XG4gIG9yaWdpbjogUG9pbnQ7XG4gIG92ZXJsYXlSZWN0OiBEaW1lbnNpb25zO1xuICBib3VuZGluZ0JveFJlY3Q6IEJvdW5kaW5nQm94UmVjdDtcbn1cblxuLyoqIEEgY29ubmVjdGVkIHBvc2l0aW9uIGFzIHNwZWNpZmllZCBieSB0aGUgdXNlci4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29ubmVjdGVkUG9zaXRpb24ge1xuICBvcmlnaW5YOiAnc3RhcnQnIHwgJ2NlbnRlcicgfCAnZW5kJztcbiAgb3JpZ2luWTogJ3RvcCcgfCAnY2VudGVyJyB8ICdib3R0b20nO1xuXG4gIG92ZXJsYXlYOiAnc3RhcnQnIHwgJ2NlbnRlcicgfCAnZW5kJztcbiAgb3ZlcmxheVk6ICd0b3AnIHwgJ2NlbnRlcicgfCAnYm90dG9tJztcblxuICB3ZWlnaHQ/OiBudW1iZXI7XG4gIG9mZnNldFg/OiBudW1iZXI7XG4gIG9mZnNldFk/OiBudW1iZXI7XG4gIHBhbmVsQ2xhc3M/OiBzdHJpbmcgfCBzdHJpbmdbXTtcbn1cblxuLyoqIFNoYWxsb3ctZXh0ZW5kcyBhIHN0eWxlc2hlZXQgb2JqZWN0IHdpdGggYW5vdGhlciBzdHlsZXNoZWV0IG9iamVjdC4gKi9cbmZ1bmN0aW9uIGV4dGVuZFN0eWxlcyhkZXN0aW5hdGlvbjogQ1NTU3R5bGVEZWNsYXJhdGlvbiwgc291cmNlOiBDU1NTdHlsZURlY2xhcmF0aW9uKTogQ1NTU3R5bGVEZWNsYXJhdGlvbiB7XG4gIGZvciAobGV0IGtleSBpbiBzb3VyY2UpIHtcbiAgICBpZiAoc291cmNlLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgIGRlc3RpbmF0aW9uW2tleV0gPSBzb3VyY2Vba2V5XTtcbiAgICB9XG4gIH1cblxuICByZXR1cm4gZGVzdGluYXRpb247XG59XG5cbi8qKlxuICogRXh0cmFjdHMgdGhlIHBpeGVsIHZhbHVlIGFzIGEgbnVtYmVyIGZyb20gYSB2YWx1ZSwgaWYgaXQncyBhIG51bWJlclxuICogb3IgYSBDU1MgcGl4ZWwgc3RyaW5nIChlLmcuIGAxMzM3cHhgKS4gT3RoZXJ3aXNlIHJldHVybnMgbnVsbC5cbiAqL1xuZnVuY3Rpb24gZ2V0UGl4ZWxWYWx1ZShpbnB1dDogbnVtYmVyIHwgc3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZCk6IG51bWJlciB8IG51bGwge1xuICBpZiAodHlwZW9mIGlucHV0ICE9PSAnbnVtYmVyJyAmJiBpbnB1dCAhPSBudWxsKSB7XG4gICAgY29uc3QgW3ZhbHVlLCB1bml0c10gPSBpbnB1dC5zcGxpdChjc3NVbml0UGF0dGVybik7XG4gICAgcmV0dXJuICF1bml0cyB8fCB1bml0cyA9PT0gJ3B4JyA/IHBhcnNlRmxvYXQodmFsdWUpIDogbnVsbDtcbiAgfVxuXG4gIHJldHVybiAoaW5wdXQgYXMgYW55KSB8fCBudWxsO1xufVxuXG4vKipcbiAqIEdldHMgYSB2ZXJzaW9uIG9mIGFuIGVsZW1lbnQncyBib3VuZGluZyBgRE9NUmVjdGAgd2hlcmUgYWxsIHRoZSB2YWx1ZXMgYXJlIHJvdW5kZWQgZG93biB0b1xuICogdGhlIG5lYXJlc3QgcGl4ZWwuIFRoaXMgYWxsb3dzIHVzIHRvIGFjY291bnQgZm9yIHRoZSBjYXNlcyB3aGVyZSB0aGVyZSBtYXkgYmUgc3ViLXBpeGVsXG4gKiBkZXZpYXRpb25zIGluIHRoZSBgRE9NUmVjdGAgcmV0dXJuZWQgYnkgdGhlIGJyb3dzZXIgKGUuZy4gd2hlbiB6b29tZWQgaW4gd2l0aCBhIHBlcmNlbnRhZ2VcbiAqIHNpemUsIHNlZSAjMjEzNTApLlxuICovXG5mdW5jdGlvbiBnZXRSb3VuZGVkQm91bmRpbmdDbGllbnRSZWN0KGNsaWVudFJlY3Q6IERpbWVuc2lvbnMpOiBEaW1lbnNpb25zIHtcbiAgcmV0dXJuIHtcbiAgICB0b3A6IE1hdGguZmxvb3IoY2xpZW50UmVjdC50b3ApLFxuICAgIHJpZ2h0OiBNYXRoLmZsb29yKGNsaWVudFJlY3QucmlnaHQpLFxuICAgIGJvdHRvbTogTWF0aC5mbG9vcihjbGllbnRSZWN0LmJvdHRvbSksXG4gICAgbGVmdDogTWF0aC5mbG9vcihjbGllbnRSZWN0LmxlZnQpLFxuICAgIHdpZHRoOiBNYXRoLmZsb29yKGNsaWVudFJlY3Qud2lkdGgpLFxuICAgIGhlaWdodDogTWF0aC5mbG9vcihjbGllbnRSZWN0LmhlaWdodCksXG4gIH07XG59XG5cbmV4cG9ydCBjb25zdCBTVEFOREFSRF9EUk9QRE9XTl9CRUxPV19QT1NJVElPTlM6IENvbm5lY3RlZFBvc2l0aW9uW10gPSBbXG4gIHsgb3JpZ2luWDogJ3N0YXJ0Jywgb3JpZ2luWTogJ2JvdHRvbScsIG92ZXJsYXlYOiAnc3RhcnQnLCBvdmVybGF5WTogJ3RvcCcgfSxcbiAgeyBvcmlnaW5YOiAnc3RhcnQnLCBvcmlnaW5ZOiAndG9wJywgb3ZlcmxheVg6ICdzdGFydCcsIG92ZXJsYXlZOiAnYm90dG9tJyB9LFxuICB7IG9yaWdpblg6ICdlbmQnLCBvcmlnaW5ZOiAnYm90dG9tJywgb3ZlcmxheVg6ICdlbmQnLCBvdmVybGF5WTogJ3RvcCcgfSxcbiAgeyBvcmlnaW5YOiAnZW5kJywgb3JpZ2luWTogJ3RvcCcsIG92ZXJsYXlYOiAnZW5kJywgb3ZlcmxheVk6ICdib3R0b20nIH0sXG5dO1xuXG5leHBvcnQgY29uc3QgU1RBTkRBUkRfRFJPUERPV05fQURKQUNFTlRfUE9TSVRJT05TOiBDb25uZWN0ZWRQb3NpdGlvbltdID0gW1xuICB7IG9yaWdpblg6ICdlbmQnLCBvcmlnaW5ZOiAndG9wJywgb3ZlcmxheVg6ICdzdGFydCcsIG92ZXJsYXlZOiAndG9wJyB9LFxuICB7IG9yaWdpblg6ICdlbmQnLCBvcmlnaW5ZOiAnYm90dG9tJywgb3ZlcmxheVg6ICdzdGFydCcsIG92ZXJsYXlZOiAnYm90dG9tJyB9LFxuICB7IG9yaWdpblg6ICdzdGFydCcsIG9yaWdpblk6ICd0b3AnLCBvdmVybGF5WDogJ2VuZCcsIG92ZXJsYXlZOiAndG9wJyB9LFxuICB7IG9yaWdpblg6ICdzdGFydCcsIG9yaWdpblk6ICdib3R0b20nLCBvdmVybGF5WDogJ2VuZCcsIG92ZXJsYXlZOiAnYm90dG9tJyB9LFxuXTtcbiJdfQ==