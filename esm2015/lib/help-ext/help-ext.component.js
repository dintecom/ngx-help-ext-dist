import { Overlay, OverlayContainer, ViewportRuler } from '@angular/cdk/overlay';
import { Platform } from '@angular/cdk/platform';
import { ComponentPortal } from '@angular/cdk/portal';
import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, HostListener, Inject, Input, ViewChild, } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter } from 'rxjs/operators';
import { HelpExtService } from '../api/help-ext.service';
import { HelpExtFlyoutComponent } from '../help-ext-flyout/help-ext-flyout.component';
import { FlexibleConnectedPositionStrategy17 } from './flexible-connected-position-strategy-v17';
const FLYOUT_SHOW_HIDE_DELAY = 100;
export class HelpExtComponent {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscC1leHQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vcHJvamVjdHMvbmd4LWhlbHAtZXh0L3NyYy9saWIvaGVscC1leHQvaGVscC1leHQuY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQWMsYUFBYSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDNUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0MsT0FBTyxFQUNMLHVCQUF1QixFQUN2QixpQkFBaUIsRUFDakIsU0FBUyxFQUVULFlBQVksRUFDWixNQUFNLEVBQ04sS0FBSyxFQUdMLFNBQVMsR0FDVixNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxPQUFPLEVBQWdCLE1BQU0sTUFBTSxDQUFDO0FBQzdDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUV4QyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDekQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDdEYsT0FBTyxFQUFFLG1DQUFtQyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFakcsTUFBTSxzQkFBc0IsR0FBRyxHQUFHLENBQUM7QUFVbkMsTUFBTSxPQUFPLGdCQUFnQjtJQTZJM0IsWUFDbUIsSUFBdUIsRUFDdkIsT0FBZSxFQUNmLFFBQWlCLEVBQ2pCLElBQW9CLEVBQ3BCLGNBQTZCLEVBQ1gsU0FBYyxFQUNoQyxTQUFtQixFQUNuQixpQkFBbUM7UUFQbkMsU0FBSSxHQUFKLElBQUksQ0FBbUI7UUFDdkIsWUFBTyxHQUFQLE9BQU8sQ0FBUTtRQUNmLGFBQVEsR0FBUixRQUFRLENBQVM7UUFDakIsU0FBSSxHQUFKLElBQUksQ0FBZ0I7UUFDcEIsbUJBQWMsR0FBZCxjQUFjLENBQWU7UUFDWCxjQUFTLEdBQVQsU0FBUyxDQUFLO1FBQ2hDLGNBQVMsR0FBVCxTQUFTLENBQVU7UUFDbkIsc0JBQWlCLEdBQWpCLGlCQUFpQixDQUFrQjtRQXZFdEQsa0JBQWEsR0FBWSxJQUFJLENBQUM7UUFHOUIsV0FBTSxHQUFZLEtBQUssQ0FBQztRQVNoQixlQUFVLEdBQUcsSUFBSSxPQUFPLEVBQVEsQ0FBQztJQTREdEMsQ0FBQztJQXBKSixJQUFXLE9BQU87UUFDaEIsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO0lBQ3ZCLENBQUM7SUFDRCxJQUFXLE9BQU8sQ0FBQyxLQUFjO1FBQy9CLElBQUksQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDO1FBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDM0IsQ0FBQztJQU9ELElBQ0ksU0FBUztRQUNYLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQztJQUN6QixDQUFDO0lBQ0QsSUFBSSxTQUFTLENBQUMsS0FBYTtRQUN6QixJQUFJLElBQUksQ0FBQyxVQUFVO1lBQUUsTUFBTSxLQUFLLENBQUMsc0NBQXNDLENBQUMsQ0FBQztRQUN6RSxJQUFJLElBQUksQ0FBQyxVQUFVO1lBQUUsTUFBTSxLQUFLLENBQUMsc0NBQXNDLENBQUMsQ0FBQztRQUV6RSxJQUFJLElBQUksQ0FBQyxVQUFVLEtBQUssS0FBSztZQUFFLE9BQU87UUFFdEMsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLENBQUM7UUFFeEIsSUFBSSxDQUFDLEtBQUs7WUFBRSxPQUFPO1FBQ25CLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FDdkMsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLEVBQ25DLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FDNUIsQ0FBQztJQUNKLENBQUM7SUFFRCxJQUNJLFVBQVU7UUFDWixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7SUFDMUIsQ0FBQztJQUNELElBQUksVUFBVSxDQUFDLEtBQWE7UUFDMUIsSUFBSSxJQUFJLENBQUMsU0FBUztZQUFFLE1BQU0sS0FBSyxDQUFDLHNDQUFzQyxDQUFDLENBQUM7UUFDeEUsSUFBSSxJQUFJLENBQUMsVUFBVTtZQUFFLE1BQU0sS0FBSyxDQUFDLHVDQUF1QyxDQUFDLENBQUM7UUFFMUUsSUFBSSxJQUFJLENBQUMsV0FBVyxLQUFLLEtBQUs7WUFBRSxPQUFPO1FBRXZDLElBQUksQ0FBQyxXQUFXLEdBQUcsS0FBSyxDQUFDO1FBRXpCLElBQUksQ0FBQyxLQUFLO1lBQUUsT0FBTztRQUNuQixJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDLFNBQVMsQ0FDekQsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLEVBQ25DLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FDNUIsQ0FBQztJQUNKLENBQUM7SUFFRCxJQUNJLFVBQVU7UUFDWixPQUFPLElBQUksQ0FBQyxXQUFXLENBQUM7SUFDMUIsQ0FBQztJQUNELElBQUksVUFBVSxDQUFDLEtBQWM7O1FBQzNCLElBQUksSUFBSSxDQUFDLFNBQVM7WUFBRSxNQUFNLEtBQUssQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO1FBQ3hFLElBQUksSUFBSSxDQUFDLFVBQVU7WUFBRSxNQUFNLEtBQUssQ0FBQyx1Q0FBdUMsQ0FBQyxDQUFDO1FBRTFFLElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxLQUFLO1lBQUUsT0FBTztRQUV2QyxJQUFJLENBQUMsV0FBVyxHQUFHLEtBQUssQ0FBQztRQUV6QixJQUFJLEtBQUssRUFBRTtZQUNULElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO1lBQzFCLElBQUksQ0FBQyx5QkFBeUIsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU07aUJBQ2pELElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxLQUFLLFlBQVksYUFBYSxDQUFDLENBQUM7aUJBQ3JELFNBQVMsQ0FBQyxHQUFHLEVBQUU7Z0JBQ2QsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7WUFDNUIsQ0FBQyxDQUFDLENBQUM7U0FDTjthQUFNO1lBQ0wsTUFBQSxJQUFJLENBQUMseUJBQXlCLDBDQUFFLFdBQVcsR0FBRztTQUMvQztJQUNILENBQUM7SUFxQkQsYUFBYTtRQUNYLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTztZQUFFLE9BQU87UUFFMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFHRCxhQUFhO1FBQ1gsSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO0lBQ3BDLENBQUM7SUFFTyxJQUFJLENBQUMsS0FBYTtRQUN4QixZQUFZLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2xDLFlBQVksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDbEMsSUFBSSxJQUFJLENBQUMsZUFBZTtZQUFFLE9BQU87UUFFakMsSUFBSSxDQUFDLGNBQWMsR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFO1lBQ3BDLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQztZQUN0RSxJQUFJLENBQUMsZUFBZSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDO1lBQzVDLElBQUksQ0FBQyxlQUFlLENBQUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUMsQ0FBQztZQUNuRixJQUFJLENBQUMsZUFBZSxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDLENBQUM7WUFDbkYsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUU1QixVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxjQUFjLEVBQUUsQ0FBQyxDQUFDO1lBRXBELElBQUksQ0FBQyxjQUFjLEdBQUcsU0FBUyxDQUFDO1FBQ2xDLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNaLENBQUM7SUFFTyxJQUFJLENBQUMsS0FBYTtRQUN4QixZQUFZLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDO1FBQ2xDLFlBQVksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDbEMsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlO1lBQUUsT0FBTztRQUVsQyxJQUFJLENBQUMsY0FBYyxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUU7WUFDcEMsSUFBSSxDQUFDLGNBQWMsR0FBRyxTQUFTLENBQUM7WUFFaEMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUM1QixJQUFJLENBQUMsZUFBZSxDQUFDLFdBQVcsQ0FBQyxTQUFTLENBQUMsR0FBRyxFQUFFO2dCQUM5QyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRSxDQUFDO2dCQUMxQixJQUFJLENBQUMsZUFBZSxHQUFHLFNBQVMsQ0FBQztZQUNuQyxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUMsRUFBRSxLQUFLLENBQUMsQ0FBQztJQUNaLENBQUM7SUFhRCxRQUFRO1FBQ04sSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLGVBQWUsQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBRTNELE1BQU0sZ0JBQWdCLEdBQUcsSUFBSSxtQ0FBbUMsQ0FDOUQsSUFBSSxDQUFDLG9CQUFvQixFQUN6QixJQUFJLENBQUMsY0FBYyxFQUNuQixJQUFJLENBQUMsU0FBUyxFQUNkLElBQUksQ0FBQyxTQUFTLEVBQ2QsSUFBSSxDQUFDLGlCQUFpQixDQUN2QjthQUNFLHNCQUFzQixDQUFDLEtBQUssQ0FBQzthQUM3QixpQkFBaUIsQ0FBQyxJQUFJLENBQUM7YUFDdkIsUUFBUSxDQUFDLElBQUksQ0FBQzthQUNkLGFBQWEsQ0FBQztZQUNiLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRTtZQUM3RSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUU7WUFDNUUsRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFO1lBQzVFLEVBQUUsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLEtBQUssRUFBRTtZQUN6RSxFQUFFLE9BQU8sRUFBRSxPQUFPLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxLQUFLLEVBQUU7WUFDekUsRUFBRSxPQUFPLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFO1NBQzlFLENBQUMsQ0FBQztRQUNMLE1BQU0sY0FBYyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDbkUsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQztZQUN0QyxnQkFBZ0IsRUFBRSxnQkFBZ0I7WUFDbEMsY0FBYyxFQUFFLGNBQWM7WUFDOUIseUdBQXlHO1lBQ3pHLFFBQVEsRUFBRSxtQkFBbUI7WUFDN0IsVUFBVSxFQUFFLGdCQUFnQjtTQUM3QixDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsV0FBVzs7UUFDVCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDO1FBQ3ZCLElBQUksQ0FBQyxVQUFVLENBQUMsUUFBUSxFQUFFLENBQUM7UUFDM0IsTUFBQSxJQUFJLENBQUMseUJBQXlCLDBDQUFFLFdBQVcsR0FBRztJQUNoRCxDQUFDO0lBRU8sa0JBQWtCO1FBQ3hCLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEdBQUcsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLFNBQVMsQ0FDdEUsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLEVBQ25DLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsQ0FDNUIsQ0FBQztJQUNKLENBQUM7OztZQTFNRixTQUFTLFNBQUM7Z0JBQ1QsUUFBUSxFQUFFLFVBQVU7Z0JBQ3BCLGdwQkFBdUM7Z0JBQ3ZDLElBQUksRUFBRTtvQkFDSixLQUFLLEVBQUUsVUFBVTtpQkFDbEI7Z0JBQ0QsZUFBZSxFQUFFLHVCQUF1QixDQUFDLE1BQU07YUFDaEQ7OztZQTNCQyxpQkFBaUI7WUFVSyxNQUFNO1lBaEJyQixPQUFPO1lBb0JQLGNBQWM7WUFwQnlCLGFBQWE7NENBcUx4RCxNQUFNLFNBQUMsUUFBUTtZQXBMWCxRQUFRO1lBREMsZ0JBQWdCOzs7d0JBaUQvQixLQUFLO3lCQW1CTCxLQUFLO3lCQW1CTCxLQUFLOzRCQXdCTCxLQUFLO3FCQUdMLEtBQUs7bUNBR0wsU0FBUyxTQUFDLGNBQWMsRUFBRSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUU7NEJBWTFDLFlBQVksU0FBQyxZQUFZOzRCQU96QixZQUFZLFNBQUMsWUFBWSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE92ZXJsYXksIE92ZXJsYXlDb250YWluZXIsIE92ZXJsYXlSZWYsIFZpZXdwb3J0UnVsZXIgfSBmcm9tICdAYW5ndWxhci9jZGsvb3ZlcmxheSc7XG5pbXBvcnQgeyBQbGF0Zm9ybSB9IGZyb20gJ0Bhbmd1bGFyL2Nkay9wbGF0Zm9ybSc7XG5pbXBvcnQgeyBDb21wb25lbnRQb3J0YWwgfSBmcm9tICdAYW5ndWxhci9jZGsvcG9ydGFsJztcbmltcG9ydCB7IERPQ1VNRU5UIH0gZnJvbSAnQGFuZ3VsYXIvY29tbW9uJztcbmltcG9ydCB7XG4gIENoYW5nZURldGVjdGlvblN0cmF0ZWd5LFxuICBDaGFuZ2VEZXRlY3RvclJlZixcbiAgQ29tcG9uZW50LFxuICBFbGVtZW50UmVmLFxuICBIb3N0TGlzdGVuZXIsXG4gIEluamVjdCxcbiAgSW5wdXQsXG4gIE9uRGVzdHJveSxcbiAgT25Jbml0LFxuICBWaWV3Q2hpbGQsXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgTmF2aWdhdGlvbkVuZCwgUm91dGVyIH0gZnJvbSAnQGFuZ3VsYXIvcm91dGVyJztcbmltcG9ydCB7IFN1YmplY3QsIFN1YnNjcmlwdGlvbiB9IGZyb20gJ3J4anMnO1xuaW1wb3J0IHsgZmlsdGVyIH0gZnJvbSAncnhqcy9vcGVyYXRvcnMnO1xuaW1wb3J0IHsgQXJ0aWNsZSB9IGZyb20gJy4uL2FwaS9hcnRpY2xlJztcbmltcG9ydCB7IEhlbHBFeHRTZXJ2aWNlIH0gZnJvbSAnLi4vYXBpL2hlbHAtZXh0LnNlcnZpY2UnO1xuaW1wb3J0IHsgSGVscEV4dEZseW91dENvbXBvbmVudCB9IGZyb20gJy4uL2hlbHAtZXh0LWZseW91dC9oZWxwLWV4dC1mbHlvdXQuY29tcG9uZW50JztcbmltcG9ydCB7IEZsZXhpYmxlQ29ubmVjdGVkUG9zaXRpb25TdHJhdGVneTE3IH0gZnJvbSAnLi9mbGV4aWJsZS1jb25uZWN0ZWQtcG9zaXRpb24tc3RyYXRlZ3ktdjE3JztcblxuY29uc3QgRkxZT1VUX1NIT1dfSElERV9ERUxBWSA9IDEwMDtcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnaGVscC1leHQnLFxuICB0ZW1wbGF0ZVVybDogJy4vaGVscC1leHQudGVtcGxhdGUuaHRtbCcsXG4gIGhvc3Q6IHtcbiAgICBjbGFzczogJ2hlbHAtZXh0JyxcbiAgfSxcbiAgY2hhbmdlRGV0ZWN0aW9uOiBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5PblB1c2gsXG59KVxuZXhwb3J0IGNsYXNzIEhlbHBFeHRDb21wb25lbnQgaW1wbGVtZW50cyBPbkRlc3Ryb3ksIE9uSW5pdCB7XG4gIHByaXZhdGUgX2FydGljbGU6IEFydGljbGU7XG4gIHB1YmxpYyBnZXQgYXJ0aWNsZSgpOiBBcnRpY2xlIHtcbiAgICByZXR1cm4gdGhpcy5fYXJ0aWNsZTtcbiAgfVxuICBwdWJsaWMgc2V0IGFydGljbGUodmFsdWU6IEFydGljbGUpIHtcbiAgICB0aGlzLl9hcnRpY2xlID0gdmFsdWU7XG4gICAgdGhpcy5fY2RyLm1hcmtGb3JDaGVjaygpO1xuICB9XG5cbiAgcHJpdmF0ZSBfcm91dGVyRXZlbnRzU3Vic2NyaXB0aW9uOiBTdWJzY3JpcHRpb247XG4gIHByaXZhdGUgX2FydGljbGVJZDogbnVtYmVyO1xuICBwcml2YXRlIF9hcnRpY2xlVWlkOiBzdHJpbmc7XG4gIHByaXZhdGUgX2J5TG9jYXRpb246IGJvb2xlYW47XG5cbiAgQElucHV0KClcbiAgZ2V0IGFydGljbGVJZCgpOiBudW1iZXIge1xuICAgIHJldHVybiB0aGlzLl9hcnRpY2xlSWQ7XG4gIH1cbiAgc2V0IGFydGljbGVJZCh2YWx1ZTogbnVtYmVyKSB7XG4gICAgaWYgKHRoaXMuYXJ0aWNsZVVpZCkgdGhyb3cgRXJyb3IoJ0RvIG5vdCB1c2UgYXJ0aWNsZUlkIHdpdGggYXJ0aWNsZVVpZCcpO1xuICAgIGlmICh0aGlzLmJ5TG9jYXRpb24pIHRocm93IEVycm9yKCdEbyBub3QgdXNlIGFydGljbGVJZCB3aXRoIGJ5TG9jYXRpb24nKTtcblxuICAgIGlmICh0aGlzLl9hcnRpY2xlSWQgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICB0aGlzLl9hcnRpY2xlSWQgPSB2YWx1ZTtcblxuICAgIGlmICghdmFsdWUpIHJldHVybjtcbiAgICB0aGlzLl9hcGkuZ2V0QXJ0aWNsZUJ5SWQodmFsdWUpLnN1YnNjcmliZShcbiAgICAgIGFydGljbGUgPT4gKHRoaXMuYXJ0aWNsZSA9IGFydGljbGUpLFxuICAgICAgKCkgPT4gKHRoaXMuYXJ0aWNsZSA9IG51bGwpLFxuICAgICk7XG4gIH1cblxuICBASW5wdXQoKVxuICBnZXQgYXJ0aWNsZVVpZCgpOiBzdHJpbmcge1xuICAgIHJldHVybiB0aGlzLl9hcnRpY2xlVWlkO1xuICB9XG4gIHNldCBhcnRpY2xlVWlkKHZhbHVlOiBzdHJpbmcpIHtcbiAgICBpZiAodGhpcy5hcnRpY2xlSWQpIHRocm93IEVycm9yKCdEbyBub3QgdXNlIGFydGljbGVVaWQgd2l0aCBhcnRpY2xlSWQnKTtcbiAgICBpZiAodGhpcy5ieUxvY2F0aW9uKSB0aHJvdyBFcnJvcignRG8gbm90IHVzZSBhcnRpY2xlVWlkIHdpdGggYnlMb2NhdGlvbicpO1xuXG4gICAgaWYgKHRoaXMuX2FydGljbGVVaWQgPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICB0aGlzLl9hcnRpY2xlVWlkID0gdmFsdWU7XG5cbiAgICBpZiAoIXZhbHVlKSByZXR1cm47XG4gICAgdGhpcy5fYXBpLmdldEFydGljbGVCeVVpZChsb2NhdGlvbi5vcmlnaW4sIHZhbHVlKS5zdWJzY3JpYmUoXG4gICAgICBhcnRpY2xlID0+ICh0aGlzLmFydGljbGUgPSBhcnRpY2xlKSxcbiAgICAgICgpID0+ICh0aGlzLmFydGljbGUgPSBudWxsKSxcbiAgICApO1xuICB9XG5cbiAgQElucHV0KClcbiAgZ2V0IGJ5TG9jYXRpb24oKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX2J5TG9jYXRpb247XG4gIH1cbiAgc2V0IGJ5TG9jYXRpb24odmFsdWU6IGJvb2xlYW4pIHtcbiAgICBpZiAodGhpcy5hcnRpY2xlSWQpIHRocm93IEVycm9yKCdEbyBub3QgdXNlIGJ5TG9jYXRpb24gd2l0aCBhcnRpY2xlSWQnKTtcbiAgICBpZiAodGhpcy5hcnRpY2xlVWlkKSB0aHJvdyBFcnJvcignRG8gbm90IHVzZSBieUxvY2F0aW9uIHdpdGggYXJ0aWNsZVVpZCcpO1xuXG4gICAgaWYgKHRoaXMuX2J5TG9jYXRpb24gPT09IHZhbHVlKSByZXR1cm47XG5cbiAgICB0aGlzLl9ieUxvY2F0aW9uID0gdmFsdWU7XG5cbiAgICBpZiAodmFsdWUpIHtcbiAgICAgIHRoaXMudXBkYXRlRnJvbUxvY2F0aW9uKCk7XG4gICAgICB0aGlzLl9yb3V0ZXJFdmVudHNTdWJzY3JpcHRpb24gPSB0aGlzLl9yb3V0ZXIuZXZlbnRzXG4gICAgICAgIC5waXBlKGZpbHRlcihldmVudCA9PiBldmVudCBpbnN0YW5jZW9mIE5hdmlnYXRpb25FbmQpKVxuICAgICAgICAuc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgICAgICB0aGlzLnVwZGF0ZUZyb21Mb2NhdGlvbigpO1xuICAgICAgICB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fcm91dGVyRXZlbnRzU3Vic2NyaXB0aW9uPy51bnN1YnNjcmliZSgpO1xuICAgIH1cbiAgfVxuXG4gIEBJbnB1dCgpXG4gIGFsd2F5c1Zpc2libGU6IGJvb2xlYW4gPSB0cnVlO1xuXG4gIEBJbnB1dCgpXG4gIGlubGluZTogYm9vbGVhbiA9IGZhbHNlO1xuXG4gIEBWaWV3Q2hpbGQoJ2hlbHBRdWVzdGlvbicsIHsgc3RhdGljOiB0cnVlIH0pXG4gIHByaXZhdGUgX2hlbHBRdWVzdGlvbkVsZW1lbnQ6IEVsZW1lbnRSZWY7XG5cbiAgcHJpdmF0ZSBfb3ZlcmxheVJlZjogT3ZlcmxheVJlZjtcbiAgcHJpdmF0ZSBfcG9ydGFsOiBDb21wb25lbnRQb3J0YWw8SGVscEV4dEZseW91dENvbXBvbmVudD47XG4gIHByaXZhdGUgX2ZseW91dEluc3RhbmNlOiBIZWxwRXh0Rmx5b3V0Q29tcG9uZW50O1xuXG4gIHByaXZhdGUgX29uRGVzdHJveSA9IG5ldyBTdWJqZWN0PHZvaWQ+KCk7XG5cbiAgcHJpdmF0ZSBfc2hvd1RpbWVvdXRJZDogUmV0dXJuVHlwZTx0eXBlb2Ygc2V0VGltZW91dD4gfCB1bmRlZmluZWQ7XG4gIHByaXZhdGUgX2hpZGVUaW1lb3V0SWQ6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgdW5kZWZpbmVkO1xuXG4gIEBIb3N0TGlzdGVuZXIoJ21vdXNlZW50ZXInKVxuICBfb25Nb3VzZUVudGVyKCkge1xuICAgIGlmICghdGhpcy5hcnRpY2xlKSByZXR1cm47XG5cbiAgICB0aGlzLnNob3coRkxZT1VUX1NIT1dfSElERV9ERUxBWSk7XG4gIH1cblxuICBASG9zdExpc3RlbmVyKCdtb3VzZWxlYXZlJylcbiAgX29uTW91c2VMZWF2ZSgpIHtcbiAgICB0aGlzLmhpZGUoRkxZT1VUX1NIT1dfSElERV9ERUxBWSk7XG4gIH1cblxuICBwcml2YXRlIHNob3coZGVsYXk6IG51bWJlcik6IHZvaWQge1xuICAgIGNsZWFyVGltZW91dCh0aGlzLl9oaWRlVGltZW91dElkKTtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5fc2hvd1RpbWVvdXRJZCk7XG4gICAgaWYgKHRoaXMuX2ZseW91dEluc3RhbmNlKSByZXR1cm47XG5cbiAgICB0aGlzLl9zaG93VGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLl9mbHlvdXRJbnN0YW5jZSA9IHRoaXMuX292ZXJsYXlSZWYuYXR0YWNoKHRoaXMuX3BvcnRhbCkuaW5zdGFuY2U7XG4gICAgICB0aGlzLl9mbHlvdXRJbnN0YW5jZS5hcnRpY2xlID0gdGhpcy5hcnRpY2xlO1xuICAgICAgdGhpcy5fZmx5b3V0SW5zdGFuY2UubW91c2VFbnRlci5zdWJzY3JpYmUoKCkgPT4gdGhpcy5zaG93KEZMWU9VVF9TSE9XX0hJREVfREVMQVkpKTtcbiAgICAgIHRoaXMuX2ZseW91dEluc3RhbmNlLm1vdXNlTGVhdmUuc3Vic2NyaWJlKCgpID0+IHRoaXMuaGlkZShGTFlPVVRfU0hPV19ISURFX0RFTEFZKSk7XG4gICAgICB0aGlzLl9mbHlvdXRJbnN0YW5jZS5zaG93KCk7XG5cbiAgICAgIHNldFRpbWVvdXQoKCkgPT4gdGhpcy5fb3ZlcmxheVJlZi51cGRhdGVQb3NpdGlvbigpKTtcblxuICAgICAgdGhpcy5fc2hvd1RpbWVvdXRJZCA9IHVuZGVmaW5lZDtcbiAgICB9LCBkZWxheSk7XG4gIH1cblxuICBwcml2YXRlIGhpZGUoZGVsYXk6IG51bWJlcik6IHZvaWQge1xuICAgIGNsZWFyVGltZW91dCh0aGlzLl9oaWRlVGltZW91dElkKTtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5fc2hvd1RpbWVvdXRJZCk7XG4gICAgaWYgKCF0aGlzLl9mbHlvdXRJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgdGhpcy5faGlkZVRpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5faGlkZVRpbWVvdXRJZCA9IHVuZGVmaW5lZDtcblxuICAgICAgdGhpcy5fZmx5b3V0SW5zdGFuY2UuaGlkZSgpO1xuICAgICAgdGhpcy5fZmx5b3V0SW5zdGFuY2UuYWZ0ZXJIaWRkZW4uc3Vic2NyaWJlKCgpID0+IHtcbiAgICAgICAgdGhpcy5fb3ZlcmxheVJlZi5kZXRhY2goKTtcbiAgICAgICAgdGhpcy5fZmx5b3V0SW5zdGFuY2UgPSB1bmRlZmluZWQ7XG4gICAgICB9KTtcbiAgICB9LCBkZWxheSk7XG4gIH1cblxuICBjb25zdHJ1Y3RvcihcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9jZHI6IENoYW5nZURldGVjdG9yUmVmLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgX3JvdXRlcjogUm91dGVyLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgX292ZXJsYXk6IE92ZXJsYXksXG4gICAgcHJpdmF0ZSByZWFkb25seSBfYXBpOiBIZWxwRXh0U2VydmljZSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IF92aWV3cG9ydFJ1bGVyOiBWaWV3cG9ydFJ1bGVyLFxuICAgIEBJbmplY3QoRE9DVU1FTlQpIHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50OiBhbnksXG4gICAgcHJpdmF0ZSByZWFkb25seSBfcGxhdGZvcm06IFBsYXRmb3JtLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgX292ZXJsYXlDb250YWluZXI6IE92ZXJsYXlDb250YWluZXIsXG4gICkge31cblxuICBuZ09uSW5pdCgpOiB2b2lkIHtcbiAgICB0aGlzLl9wb3J0YWwgPSBuZXcgQ29tcG9uZW50UG9ydGFsKEhlbHBFeHRGbHlvdXRDb21wb25lbnQpO1xuXG4gICAgY29uc3QgcG9zaXRpb25TdHJhdGVneSA9IG5ldyBGbGV4aWJsZUNvbm5lY3RlZFBvc2l0aW9uU3RyYXRlZ3kxNyhcbiAgICAgIHRoaXMuX2hlbHBRdWVzdGlvbkVsZW1lbnQsXG4gICAgICB0aGlzLl92aWV3cG9ydFJ1bGVyLFxuICAgICAgdGhpcy5fZG9jdW1lbnQsXG4gICAgICB0aGlzLl9wbGF0Zm9ybSxcbiAgICAgIHRoaXMuX292ZXJsYXlDb250YWluZXIsXG4gICAgKVxuICAgICAgLndpdGhGbGV4aWJsZURpbWVuc2lvbnMoZmFsc2UpXG4gICAgICAud2l0aEdyb3dBZnRlck9wZW4odHJ1ZSlcbiAgICAgIC53aXRoUHVzaCh0cnVlKVxuICAgICAgLndpdGhQb3NpdGlvbnMoW1xuICAgICAgICB7IG9yaWdpblg6ICdjZW50ZXInLCBvcmlnaW5ZOiAnYm90dG9tJywgb3ZlcmxheVg6ICdjZW50ZXInLCBvdmVybGF5WTogJ3RvcCcgfSwgLy8gYm90dG9tXG4gICAgICAgIHsgb3JpZ2luWDogJ2VuZCcsIG9yaWdpblk6ICdjZW50ZXInLCBvdmVybGF5WDogJ3N0YXJ0Jywgb3ZlcmxheVk6ICdjZW50ZXInIH0sIC8vIHJpZ2h0XG4gICAgICAgIHsgb3JpZ2luWDogJ3N0YXJ0Jywgb3JpZ2luWTogJ2NlbnRlcicsIG92ZXJsYXlYOiAnZW5kJywgb3ZlcmxheVk6ICdjZW50ZXInIH0sIC8vIGxlZnRcbiAgICAgICAgeyBvcmlnaW5YOiAnZW5kJywgb3JpZ2luWTogJ2NlbnRlcicsIG92ZXJsYXlYOiAnc3RhcnQnLCBvdmVybGF5WTogJ3RvcCcgfSwgLy8gZm9yY2UgcmlnaHRcbiAgICAgICAgeyBvcmlnaW5YOiAnc3RhcnQnLCBvcmlnaW5ZOiAnY2VudGVyJywgb3ZlcmxheVg6ICdlbmQnLCBvdmVybGF5WTogJ3RvcCcgfSwgLy8gZm9yY2UgbGVmdFxuICAgICAgICB7IG9yaWdpblg6ICdjZW50ZXInLCBvcmlnaW5ZOiAndG9wJywgb3ZlcmxheVg6ICdjZW50ZXInLCBvdmVybGF5WTogJ2JvdHRvbScgfSwgLy8gdG9wXG4gICAgICBdKTtcbiAgICBjb25zdCBzY3JvbGxTdHJhdGVneSA9IHRoaXMuX292ZXJsYXkuc2Nyb2xsU3RyYXRlZ2llcy5yZXBvc2l0aW9uKCk7XG4gICAgdGhpcy5fb3ZlcmxheVJlZiA9IHRoaXMuX292ZXJsYXkuY3JlYXRlKHtcbiAgICAgIHBvc2l0aW9uU3RyYXRlZ3k6IHBvc2l0aW9uU3RyYXRlZ3ksXG4gICAgICBzY3JvbGxTdHJhdGVneTogc2Nyb2xsU3RyYXRlZ3ksXG4gICAgICAvL21heEhlaWdodDogd2luZG93LmlubmVySGVpZ2h0IC0gdGhpcy5faGVscFF1ZXN0aW9uRWxlbWVudC5uYXRpdmVFbGVtZW50LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpLmJvdHRvbSxcbiAgICAgIG1heFdpZHRoOiAnbWluKDkyMHB4LCAxMDB2dyknLFxuICAgICAgcGFuZWxDbGFzczogJ2hlbHAtZXh0LXBhbmVsJyxcbiAgICB9KTtcbiAgfVxuXG4gIG5nT25EZXN0cm95KCk6IHZvaWQge1xuICAgIHRoaXMuX29uRGVzdHJveS5uZXh0KCk7XG4gICAgdGhpcy5fb25EZXN0cm95LmNvbXBsZXRlKCk7XG4gICAgdGhpcy5fcm91dGVyRXZlbnRzU3Vic2NyaXB0aW9uPy51bnN1YnNjcmliZSgpO1xuICB9XG5cbiAgcHJpdmF0ZSB1cGRhdGVGcm9tTG9jYXRpb24oKTogdm9pZCB7XG4gICAgdGhpcy5fYXBpLmdldEFydGljbGVCeVVybChsb2NhdGlvbi5vcmlnaW4gKyBsb2NhdGlvbi5wYXRobmFtZSkuc3Vic2NyaWJlKFxuICAgICAgYXJ0aWNsZSA9PiAodGhpcy5hcnRpY2xlID0gYXJ0aWNsZSksXG4gICAgICAoKSA9PiAodGhpcy5hcnRpY2xlID0gbnVsbCksXG4gICAgKTtcbiAgfVxufVxuIl19