import { HttpClient } from '@angular/common/http';
import { InjectionToken, SecurityContext, ElementRef, Injectable, Inject, EventEmitter, Component, ChangeDetectionStrategy, Input, Output, HostListener, HostBinding, ChangeDetectorRef, ViewChild, Directive, NgModule } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { of, isObservable, throwError, Subject, Subscription } from 'rxjs';
import { shareReplay, mergeMap, map, tap, catchError, finalize, share, filter } from 'rxjs/operators';
import { ConnectedOverlayPositionChange, validateHorizontalPosition, validateVerticalPosition, Overlay, ViewportRuler, OverlayContainer, OverlayModule } from '@angular/cdk/overlay';
import { Platform } from '@angular/cdk/platform';
import { ComponentPortal, PortalModule } from '@angular/cdk/portal';
import { DOCUMENT, CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { coerceCssPixelValue, coerceArray } from '@angular/cdk/coercion';

class Article {
}

class Attachment {
}

class HelpExtUrlResolver {
}
const HELP_EXT_URL_TOKEN = new InjectionToken('HELP_EXT_URL');
const HELP_EXT_CACHE_LIFETIME_TOKEN = new InjectionToken('HELP_EXT_CACHE_LIFETIME');
const HELP_EXT_HTTP_HEADERS = new InjectionToken('HELP_EXT_HTTP_HEADERS');

const cacheLifetimeSecondDefault = 30 * 60;
class HelpExtService {
    constructor(helpExtUrlResolver, _http, _sanitizer, helpExtUrl, cacheLifetimeSecond, _httpHeaders) {
        this._http = _http;
        this._sanitizer = _sanitizer;
        this._httpHeaders = _httpHeaders;
        this.cacheById = {};
        this.requestCacheById = {};
        this.cacheByUid = {};
        this.requestCacheByUid = {};
        this.cacheByUrl = {};
        this.requestCacheByUrl = {};
        if (helpExtUrlResolver) {
            const resolved = helpExtUrlResolver.resolve();
            if (typeof resolved === 'string') {
                this.baseAddress = of(resolved).pipe(shareReplay(1));
            }
            else if (isObservable(resolved)) {
                this.baseAddress = resolved.pipe(shareReplay(1));
            }
            else {
                throw Error('Not supported helpExtUrlResolver');
            }
        }
        else if (helpExtUrl) {
            this.baseAddress = of(helpExtUrl).pipe(shareReplay(1));
        }
        else {
            throw Error('Please, configure helpExtUrl or helpExtUrlResolver');
        }
        this.cacheLifetime = cacheLifetimeSecond * 1000;
    }
    getArticleById(id) {
        return this.baseAddress.pipe(mergeMap(baseAddress => this.cachedGet(this.cacheById, this.requestCacheById, id, `${baseAddress}/api/Clients/GetArticleById/${id}`)));
    }
    getArticleByUid(siteOrigin, uid) {
        return this.baseAddress.pipe(mergeMap(baseAddress => this.cachedGet(this.cacheByUid, this.requestCacheByUid, uid, `${baseAddress}/api/Clients/GetArticleByUid?siteOrigin=${encodeURIComponent(siteOrigin)}&uid=${encodeURIComponent(uid)}`)));
    }
    getArticleByUrl(url) {
        return this.baseAddress.pipe(mergeMap(baseAddress => this.cachedGet(this.cacheByUrl, this.requestCacheByUrl, url, `${baseAddress}/api/Clients/GetArticleByUrl?url=${encodeURIComponent(url)}`)));
    }
    sanitizeContent(content) {
        return this._sanitizer.sanitize(SecurityContext.HTML, this._sanitizer.bypassSecurityTrustHtml(content));
    }
    makeAbsoluteLinks(element, baseAddress, linkTarget) {
        const el = element instanceof ElementRef ? element.nativeElement : element;
        const links = el.getElementsByTagName('a');
        for (let i = 0; i < links.length; i++) {
            if (linkTarget) {
                links[i].setAttribute('target', linkTarget);
            }
            let href = links[i].getAttribute('href');
            if (/(?:^[a-z][a-z0-9+.-]*:|\/\/)/.test(href))
                continue;
            href = `${baseAddress}/${href}`;
            links[i].setAttribute('href', href);
        }
    }
    cachedGet(cache, requestCache, key, httpUrl) {
        if (cache[key]) {
            return cache[key].error ? throwError(cache[key].error) : of(cache[key].article);
        }
        if (requestCache[key])
            return requestCache[key];
        const request = {};
        if (this._httpHeaders) {
            request.headers = this._httpHeaders;
        }
        requestCache[key] = this._http.get(httpUrl, request).pipe(map(a => a), tap(a => {
            delete requestCache[key];
            cache[key] = {
                article: a,
            };
        }), catchError(e => {
            delete requestCache[key];
            cache[key] = {
                error: e,
            };
            return throwError(e);
        }), finalize(() => {
            setTimeout(() => delete cache[key], this.cacheLifetime);
        }), share());
        return requestCache[key];
    }
}
HelpExtService.decorators = [
    { type: Injectable }
];
HelpExtService.ctorParameters = () => [
    { type: HelpExtUrlResolver },
    { type: HttpClient },
    { type: DomSanitizer },
    { type: String, decorators: [{ type: Inject, args: [HELP_EXT_URL_TOKEN,] }] },
    { type: Number, decorators: [{ type: Inject, args: [HELP_EXT_CACHE_LIFETIME_TOKEN,] }] },
    { type: undefined, decorators: [{ type: Inject, args: [HELP_EXT_HTTP_HEADERS,] }] }
];

const helpExtFlyoutAnimations = {
    flyoutState: trigger('state', [
        state('initial, void, hidden', style({ opacity: 0 })),
        transition('* => visible', animate('200ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 1 }))),
        transition('* => hidden', animate('100ms cubic-bezier(0, 0, 0.2, 1)', style({ opacity: 0 }))),
    ]),
};

class HelpExtFlyoutComponent {
    constructor() {
        this.mouseEnter = new EventEmitter();
        this.mouseLeave = new EventEmitter();
        this.afterHidden = new EventEmitter();
        this._visibility = 'initial';
    }
    _onMouseEnter() {
        this.mouseEnter.emit();
    }
    _onMouseLeave() {
        this.mouseLeave.emit();
    }
    _onStateDone(event) {
        const toState = event.toState;
        if (toState === 'hidden' && !this.isVisible()) {
            this.afterHidden.emit();
        }
    }
    show() {
        this._visibility = 'visible';
    }
    hide() {
        this._visibility = 'hidden';
    }
    isVisible() {
        return this._visibility === 'visible';
    }
}
HelpExtFlyoutComponent.decorators = [
    { type: Component, args: [{
                selector: 'help-ext-flyout',
                template: "<help-ext-article-content class=\"help-ext-flyout-content\" [content]=\"article?.content\"></help-ext-article-content>\n<div class=\"help-ext-flyout-attachments\" *ngIf=\"article?.attachments?.length\">\n  <h2 class=\"help-ext-flyout-attachments-title\">Attachments ({{article.attachments?.length}})</h2>\n  <help-ext-attachment *ngFor=\"let attachment of article.attachments\" [attachment]=\"attachment\"></help-ext-attachment>\n</div>\n",
                animations: [helpExtFlyoutAnimations.flyoutState],
                changeDetection: ChangeDetectionStrategy.OnPush,
                host: {
                    class: 'help-ext-flyout',
                }
            },] }
];
HelpExtFlyoutComponent.propDecorators = {
    article: [{ type: Input }],
    mouseEnter: [{ type: Output }],
    mouseLeave: [{ type: Output }],
    afterHidden: [{ type: Output }],
    _onMouseEnter: [{ type: HostListener, args: ['mouseenter',] }],
    _onMouseLeave: [{ type: HostListener, args: ['mouseleave',] }],
    _visibility: [{ type: HostBinding, args: ['@state',] }],
    _onStateDone: [{ type: HostListener, args: ['@state.done', ['$event'],] }]
};

/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
/**
 * Gets whether an element is scrolled outside of view by any of its parent scrolling containers.
 * @param element Dimensions of the element (from getBoundingClientRect)
 * @param scrollContainers Dimensions of element's scrolling containers (from getBoundingClientRect)
 * @returns Whether the element is scrolled out of view
 * @docs-private
 */
function isElementScrolledOutsideView(element, scrollContainers) {
    return scrollContainers.some(containerBounds => {
        const outsideAbove = element.bottom < containerBounds.top;
        const outsideBelow = element.top > containerBounds.bottom;
        const outsideLeft = element.right < containerBounds.left;
        const outsideRight = element.left > containerBounds.right;
        return outsideAbove || outsideBelow || outsideLeft || outsideRight;
    });
}
/**
 * Gets whether an element is clipped by any of its scrolling containers.
 * @param element Dimensions of the element (from getBoundingClientRect)
 * @param scrollContainers Dimensions of element's scrolling containers (from getBoundingClientRect)
 * @returns Whether the element is clipped
 * @docs-private
 */
function isElementClippedByScrolling(element, scrollContainers) {
    return scrollContainers.some(scrollContainerRect => {
        const clippedAbove = element.top < scrollContainerRect.top;
        const clippedBelow = element.bottom > scrollContainerRect.bottom;
        const clippedLeft = element.left < scrollContainerRect.left;
        const clippedRight = element.right > scrollContainerRect.right;
        return clippedAbove || clippedBelow || clippedLeft || clippedRight;
    });
}

/**
 * @license
 * Copyright Google LLC All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */
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
class FlexibleConnectedPositionStrategy17 {
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
const STANDARD_DROPDOWN_BELOW_POSITIONS = [
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top' },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom' },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top' },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom' },
];
const STANDARD_DROPDOWN_ADJACENT_POSITIONS = [
    { originX: 'end', originY: 'top', overlayX: 'start', overlayY: 'top' },
    { originX: 'end', originY: 'bottom', overlayX: 'start', overlayY: 'bottom' },
    { originX: 'start', originY: 'top', overlayX: 'end', overlayY: 'top' },
    { originX: 'start', originY: 'bottom', overlayX: 'end', overlayY: 'bottom' },
];

const FLYOUT_SHOW_HIDE_DELAY = 100;
class HelpExtComponent {
    constructor(_cdr, _router, _overlay, _api, _viewportRuler, _document, _platform, _overlayContainer) {
        this._cdr = _cdr;
        this._router = _router;
        this._overlay = _overlay;
        this._api = _api;
        this._viewportRuler = _viewportRuler;
        this._document = _document;
        this._platform = _platform;
        this._overlayContainer = _overlayContainer;
        this.alwaysVisible = true;
        this.inline = false;
        this._onDestroy = new Subject();
    }
    get article() {
        return this._article;
    }
    set article(value) {
        this._article = value;
        this._cdr.markForCheck();
    }
    get articleId() {
        return this._articleId;
    }
    set articleId(value) {
        if (this.articleUid)
            throw Error('Do not use articleId with articleUid');
        if (this.byLocation)
            throw Error('Do not use articleId with byLocation');
        if (this._articleId === value)
            return;
        this._articleId = value;
        if (!value)
            return;
        this._api.getArticleById(value).subscribe(article => (this.article = article), () => (this.article = null));
    }
    get articleUid() {
        return this._articleUid;
    }
    set articleUid(value) {
        if (this.articleId)
            throw Error('Do not use articleUid with articleId');
        if (this.byLocation)
            throw Error('Do not use articleUid with byLocation');
        if (this._articleUid === value)
            return;
        this._articleUid = value;
        if (!value)
            return;
        this._api.getArticleByUid(location.origin, value).subscribe(article => (this.article = article), () => (this.article = null));
    }
    get byLocation() {
        return this._byLocation;
    }
    set byLocation(value) {
        var _a;
        if (this.articleId)
            throw Error('Do not use byLocation with articleId');
        if (this.articleUid)
            throw Error('Do not use byLocation with articleUid');
        if (this._byLocation === value)
            return;
        this._byLocation = value;
        if (value) {
            this.updateFromLocation();
            this._routerEventsSubscription = this._router.events
                .pipe(filter(event => event instanceof NavigationEnd))
                .subscribe(() => {
                this.updateFromLocation();
            });
        }
        else {
            (_a = this._routerEventsSubscription) === null || _a === void 0 ? void 0 : _a.unsubscribe();
        }
    }
    _onMouseEnter() {
        if (!this.article)
            return;
        this.show(FLYOUT_SHOW_HIDE_DELAY);
    }
    _onMouseLeave() {
        this.hide(FLYOUT_SHOW_HIDE_DELAY);
    }
    show(delay) {
        clearTimeout(this._hideTimeoutId);
        clearTimeout(this._showTimeoutId);
        if (this._flyoutInstance)
            return;
        this._showTimeoutId = setTimeout(() => {
            this._flyoutInstance = this._overlayRef.attach(this._portal).instance;
            this._flyoutInstance.article = this.article;
            this._flyoutInstance.mouseEnter.subscribe(() => this.show(FLYOUT_SHOW_HIDE_DELAY));
            this._flyoutInstance.mouseLeave.subscribe(() => this.hide(FLYOUT_SHOW_HIDE_DELAY));
            this._flyoutInstance.show();
            setTimeout(() => this._overlayRef.updatePosition());
            this._showTimeoutId = undefined;
        }, delay);
    }
    hide(delay) {
        clearTimeout(this._hideTimeoutId);
        clearTimeout(this._showTimeoutId);
        if (!this._flyoutInstance)
            return;
        this._hideTimeoutId = setTimeout(() => {
            this._hideTimeoutId = undefined;
            this._flyoutInstance.hide();
            this._flyoutInstance.afterHidden.subscribe(() => {
                this._overlayRef.detach();
                this._flyoutInstance = undefined;
            });
        }, delay);
    }
    ngOnInit() {
        this._portal = new ComponentPortal(HelpExtFlyoutComponent);
        const positionStrategy = new FlexibleConnectedPositionStrategy17(this._helpQuestionElement, this._viewportRuler, this._document, this._platform, this._overlayContainer)
            .withFlexibleDimensions(false)
            .withGrowAfterOpen(true)
            .withPush(true)
            .withPositions([
            { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top' },
            { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'center' },
            { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center' },
            { originX: 'end', originY: 'center', overlayX: 'start', overlayY: 'top' },
            { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'top' },
            { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom' },
        ]);
        const scrollStrategy = this._overlay.scrollStrategies.reposition();
        this._overlayRef = this._overlay.create({
            positionStrategy: positionStrategy,
            scrollStrategy: scrollStrategy,
            //maxHeight: window.innerHeight - this._helpQuestionElement.nativeElement.getBoundingClientRect().bottom,
            maxWidth: 'min(920px, 100vw)',
            panelClass: 'help-ext-panel',
        });
    }
    ngOnDestroy() {
        var _a;
        this._onDestroy.next();
        this._onDestroy.complete();
        (_a = this._routerEventsSubscription) === null || _a === void 0 ? void 0 : _a.unsubscribe();
    }
    updateFromLocation() {
        this._api.getArticleByUrl(location.origin + location.pathname).subscribe(article => (this.article = article), () => (this.article = null));
    }
}
HelpExtComponent.decorators = [
    { type: Component, args: [{
                selector: 'help-ext',
                template: "<svg\n  xmlns=\"http://www.w3.org/2000/svg\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  width=\"24\"\n  class=\"help-ext-icon\"\n  [ngStyle]=\"{'font-size': inline ? '0.5em' : '10px'}\"\n  [class.invisible]=\"!(alwaysVisible || article)\"\n  [class.disabled]=\"!article\"\n  #helpQuestion\n>\n  <path d=\"M0 0h24v24H0z\" fill=\"none\" />\n  <path\n    d=\"M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 17h-2v-2h2v2zm2.07-7.75l-.9.92C13.45 12.9 13 13.5 13 15h-2v-.5c0-1.1.45-2.1 1.17-2.83l1.24-1.26c.37-.36.59-.86.59-1.41 0-1.1-.9-2-2-2s-2 .9-2 2H8c0-2.21 1.79-4 4-4s4 1.79 4 4c0 .88-.36 1.68-.93 2.25z\"\n  />\n</svg>\n",
                host: {
                    class: 'help-ext',
                },
                changeDetection: ChangeDetectionStrategy.OnPush
            },] }
];
HelpExtComponent.ctorParameters = () => [
    { type: ChangeDetectorRef },
    { type: Router },
    { type: Overlay },
    { type: HelpExtService },
    { type: ViewportRuler },
    { type: undefined, decorators: [{ type: Inject, args: [DOCUMENT,] }] },
    { type: Platform },
    { type: OverlayContainer }
];
HelpExtComponent.propDecorators = {
    articleId: [{ type: Input }],
    articleUid: [{ type: Input }],
    byLocation: [{ type: Input }],
    alwaysVisible: [{ type: Input }],
    inline: [{ type: Input }],
    _helpQuestionElement: [{ type: ViewChild, args: ['helpQuestion', { static: true },] }],
    _onMouseEnter: [{ type: HostListener, args: ['mouseenter',] }],
    _onMouseLeave: [{ type: HostListener, args: ['mouseleave',] }]
};

class HelpExtArticleContentComponent {
    constructor(_el, _api, _cdr) {
        this._el = _el;
        this._api = _api;
        this._cdr = _cdr;
    }
    /**
     * @deprecated Use content instead
     * @see `content`
     */
    set article(value) {
        this.content = value === null || value === void 0 ? void 0 : value.content;
    }
    set content(value) {
        this._api.baseAddress.subscribe(baseAddress => {
            this._el.nativeElement.innerHTML = this._api.sanitizeContent(value);
            this._api.makeAbsoluteLinks(this._el, baseAddress, '_blank');
            this._cdr.markForCheck();
        });
    }
}
HelpExtArticleContentComponent.decorators = [
    { type: Component, args: [{
                selector: 'help-ext-article-content',
                template: '',
                changeDetection: ChangeDetectionStrategy.OnPush
            },] }
];
HelpExtArticleContentComponent.ctorParameters = () => [
    { type: ElementRef },
    { type: HelpExtService },
    { type: ChangeDetectorRef }
];
HelpExtArticleContentComponent.propDecorators = {
    article: [{ type: Input }],
    content: [{ type: Input }]
};

class HelpExtUidDirective {
    constructor(_api, _host) {
        this._api = _api;
        this._host = _host;
    }
    set uid(value) {
        this._api.getArticleByUid(location.origin, value).subscribe(article => (this._host.article = article), () => (this._host.article = null));
    }
}
HelpExtUidDirective.decorators = [
    { type: Directive, args: [{
                selector: 'help-ext-article-content[uid]',
                exportAs: 'helpExtUid',
            },] }
];
HelpExtUidDirective.ctorParameters = () => [
    { type: HelpExtService },
    { type: HelpExtArticleContentComponent }
];
HelpExtUidDirective.propDecorators = {
    uid: [{ type: Input }]
};

class HelpExtAttachmentComponent {
}
HelpExtAttachmentComponent.decorators = [
    { type: Component, args: [{
                selector: 'help-ext-attachment',
                template: "<a class=\"help-ext-flyout-attachment\" [href]=\"attachment.url\" target=\"_blank\">\n  <svg\n    class=\"help-ext-flyout-attachment-icon\"\n    xmlns=\"http://www.w3.org/2000/svg\"\n    viewBox=\"0 0 24 24\"\n    width=\"20\"\n    height=\"20\"\n  >\n    <path\n      d=\"M12.76 19.94A5.49 5.49 0 015 12.18l8.76-8.75a3.72 3.72 0 016.34 2.63A3.68 3.68 0 0119 8.68L10.67 17a1.36 1.36 0 01-1.92-1.9l8.34-8.34-1.42-1.41-8.34 8.34a3.36 3.36 0 004.75 4.75l8.35-8.34A5.72 5.72 0 0012.34 2l-8.76 8.77a7.49 7.49 0 0010.59 10.59l7.92-7.93L20.68 12z\"\n    />\n  </svg>\n  {{attachment.name}}\n</a>\n",
                changeDetection: ChangeDetectionStrategy.OnPush
            },] }
];
HelpExtAttachmentComponent.propDecorators = {
    attachment: [{ type: Input }]
};

class HelpExtModule {
    static forRoot(config) {
        return {
            ngModule: HelpExtModule,
            providers: [
                config.helpExtUrlResolver || { provide: HelpExtUrlResolver, useValue: null },
                {
                    provide: HELP_EXT_URL_TOKEN,
                    useValue: config.helpExtUrl,
                },
                {
                    provide: HELP_EXT_CACHE_LIFETIME_TOKEN,
                    useValue: isNaN(config.cacheLifetimeSecond) ? cacheLifetimeSecondDefault : config.cacheLifetimeSecond,
                },
                {
                    provide: HELP_EXT_HTTP_HEADERS,
                    useValue: config.httpHeaders,
                },
                HelpExtService,
            ],
        };
    }
}
HelpExtModule.decorators = [
    { type: NgModule, args: [{
                imports: [CommonModule, PortalModule, OverlayModule],
                declarations: [
                    HelpExtComponent,
                    HelpExtFlyoutComponent,
                    HelpExtArticleContentComponent,
                    HelpExtAttachmentComponent,
                    HelpExtUidDirective,
                ],
                exports: [HelpExtComponent, HelpExtArticleContentComponent, HelpExtAttachmentComponent, HelpExtUidDirective],
                entryComponents: [HelpExtFlyoutComponent],
            },] }
];

/*
 * Public API Surface of ngx-help-ext
 */

/**
 * Generated bundle index. Do not edit.
 */

export { Article, Attachment, HELP_EXT_CACHE_LIFETIME_TOKEN, HELP_EXT_HTTP_HEADERS, HELP_EXT_URL_TOKEN, HelpExtComponent, HelpExtModule, HelpExtService, HelpExtUrlResolver, cacheLifetimeSecondDefault as ɵa, HelpExtFlyoutComponent as ɵb, helpExtFlyoutAnimations as ɵc, HelpExtArticleContentComponent as ɵd, HelpExtAttachmentComponent as ɵe, HelpExtUidDirective as ɵf };
//# sourceMappingURL=dintecom-ngx-help-ext.js.map
