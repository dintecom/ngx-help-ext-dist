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
            .withFlexibleDimensions(true)
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscC1leHQuY29tcG9uZW50LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vcHJvamVjdHMvbmd4LWhlbHAtZXh0L3NyYy9saWIvaGVscC1leHQvaGVscC1leHQuY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxPQUFPLEVBQUUsZ0JBQWdCLEVBQWMsYUFBYSxFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFDNUYsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHVCQUF1QixDQUFDO0FBQ2pELE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQztBQUN0RCxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0saUJBQWlCLENBQUM7QUFDM0MsT0FBTyxFQUNMLHVCQUF1QixFQUN2QixpQkFBaUIsRUFDakIsU0FBUyxFQUVULFlBQVksRUFDWixNQUFNLEVBQ04sS0FBSyxFQUdMLFNBQVMsR0FDVixNQUFNLGVBQWUsQ0FBQztBQUN2QixPQUFPLEVBQUUsYUFBYSxFQUFFLE1BQU0sRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQ3hELE9BQU8sRUFBRSxPQUFPLEVBQWdCLE1BQU0sTUFBTSxDQUFDO0FBQzdDLE9BQU8sRUFBRSxNQUFNLEVBQUUsTUFBTSxnQkFBZ0IsQ0FBQztBQUV4QyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFDekQsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sOENBQThDLENBQUM7QUFDdEYsT0FBTyxFQUFFLG1DQUFtQyxFQUFFLE1BQU0sNENBQTRDLENBQUM7QUFFakcsTUFBTSxzQkFBc0IsR0FBRyxHQUFHLENBQUM7QUFVbkMsTUFBTSxPQUFPLGdCQUFnQjtJQTJJM0IsWUFDbUIsSUFBdUIsRUFDdkIsT0FBZSxFQUNmLFFBQWlCLEVBQ2pCLElBQW9CLEVBQ3BCLGNBQTZCLEVBQ1gsU0FBYyxFQUNoQyxTQUFtQixFQUNuQixpQkFBbUM7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bmVyLCBPdmVybGF5UmVmLCBWaWV3cG9ydFJ1bGVyIH0gZnJvbSAnQGFuZ3VsYXIvY2RrL292ZXJsYXknO1xuaW1wb3J0IHsgUGxhdGZvcm0gfSBmcm9tICdAYW5ndWxhci9jZGsvcGxhdGZvcm0nO1xuaW1wb3J0IHsgQ29tcG9uZW50UG9ydGFsIH0gZnJvbSAnQGFuZ3VsYXIvY2RrL3BvcnRhbCc7XG5pbXBvcnQgeyBET0NVTUVOVCB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XG5pbXBvcnQge1xuICBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSxcbiAgQ2hhbmdlRGV0ZWN0b3JSZWYsXG4gIENvbXBvbmVudCxcbiAgRWxlbWVudFJlZixcbiAgSG9zdExpc3RlbmVyLFxuICBJbmplY3QsXG4gIElucHV0LFxuICBPbkRlc3Ryb3ksXG4gIE9uSW5pdCxcbiAgVmlld0NoaWxkLFxufSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IE5hdmlnYXRpb25FbmQsIFJvdXRlciB9IGZyb20gJ0Bhbmd1bGFyL3JvdXRlcic7XG5pbXBvcnQgeyBTdWJqZWN0LCBTdWJzY3JpcHRpb24gfSBmcm9tICdyeGpzJztcbmltcG9ydCB7IGZpbHRlciB9IGZyb20gJ3J4anMvb3BlcmF0b3JzJztcbmltcG9ydCB7IEFydGljbGUgfSBmcm9tICcuLi9hcGkvYXJ0aWNsZSc7XG5pbXBvcnQgeyBIZWxwRXh0U2VydmljZSB9IGZyb20gJy4uL2FwaS9oZWxwLWV4dC5zZXJ2aWNlJztcbmltcG9ydCB7IEhlbHBFeHRGbHlvdXRDb21wb25lbnQgfSBmcm9tICcuLi9oZWxwLWV4dC1mbHlvdXQvaGVscC1leHQtZmx5b3V0LmNvbXBvbmVudCc7XG5pbXBvcnQgeyBGbGV4aWJsZUNvbm5lY3RlZFBvc2l0aW9uU3RyYXRlZ3kxNyB9IGZyb20gJy4vZmxleGlibGUtY29ubmVjdGVkLXBvc2l0aW9uLXN0cmF0ZWd5LXYxNyc7XG5cbmNvbnN0IEZMWU9VVF9TSE9XX0hJREVfREVMQVkgPSAxMDA7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2hlbHAtZXh0JyxcbiAgdGVtcGxhdGVVcmw6ICcuL2hlbHAtZXh0LnRlbXBsYXRlLmh0bWwnLFxuICBob3N0OiB7XG4gICAgY2xhc3M6ICdoZWxwLWV4dCcsXG4gIH0sXG4gIGNoYW5nZURldGVjdGlvbjogQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3kuT25QdXNoLFxufSlcbmV4cG9ydCBjbGFzcyBIZWxwRXh0Q29tcG9uZW50IGltcGxlbWVudHMgT25EZXN0cm95LCBPbkluaXQge1xuICBwcml2YXRlIF9hcnRpY2xlOiBBcnRpY2xlO1xuICBwdWJsaWMgZ2V0IGFydGljbGUoKTogQXJ0aWNsZSB7XG4gICAgcmV0dXJuIHRoaXMuX2FydGljbGU7XG4gIH1cbiAgcHVibGljIHNldCBhcnRpY2xlKHZhbHVlOiBBcnRpY2xlKSB7XG4gICAgdGhpcy5fYXJ0aWNsZSA9IHZhbHVlO1xuICAgIHRoaXMuX2Nkci5tYXJrRm9yQ2hlY2soKTtcbiAgfVxuXG4gIHByaXZhdGUgX3JvdXRlckV2ZW50c1N1YnNjcmlwdGlvbjogU3Vic2NyaXB0aW9uO1xuICBwcml2YXRlIF9hcnRpY2xlSWQ6IG51bWJlcjtcbiAgcHJpdmF0ZSBfYXJ0aWNsZVVpZDogc3RyaW5nO1xuICBwcml2YXRlIF9ieUxvY2F0aW9uOiBib29sZWFuO1xuXG4gIEBJbnB1dCgpXG4gIGdldCBhcnRpY2xlSWQoKTogbnVtYmVyIHtcbiAgICByZXR1cm4gdGhpcy5fYXJ0aWNsZUlkO1xuICB9XG4gIHNldCBhcnRpY2xlSWQodmFsdWU6IG51bWJlcikge1xuICAgIGlmICh0aGlzLmFydGljbGVVaWQpIHRocm93IEVycm9yKCdEbyBub3QgdXNlIGFydGljbGVJZCB3aXRoIGFydGljbGVVaWQnKTtcbiAgICBpZiAodGhpcy5ieUxvY2F0aW9uKSB0aHJvdyBFcnJvcignRG8gbm90IHVzZSBhcnRpY2xlSWQgd2l0aCBieUxvY2F0aW9uJyk7XG5cbiAgICBpZiAodGhpcy5fYXJ0aWNsZUlkID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgdGhpcy5fYXJ0aWNsZUlkID0gdmFsdWU7XG5cbiAgICBpZiAoIXZhbHVlKSByZXR1cm47XG4gICAgdGhpcy5fYXBpLmdldEFydGljbGVCeUlkKHZhbHVlKS5zdWJzY3JpYmUoXG4gICAgICBhcnRpY2xlID0+ICh0aGlzLmFydGljbGUgPSBhcnRpY2xlKSxcbiAgICAgICgpID0+ICh0aGlzLmFydGljbGUgPSBudWxsKSxcbiAgICApO1xuICB9XG5cbiAgQElucHV0KClcbiAgZ2V0IGFydGljbGVVaWQoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gdGhpcy5fYXJ0aWNsZVVpZDtcbiAgfVxuICBzZXQgYXJ0aWNsZVVpZCh2YWx1ZTogc3RyaW5nKSB7XG4gICAgaWYgKHRoaXMuYXJ0aWNsZUlkKSB0aHJvdyBFcnJvcignRG8gbm90IHVzZSBhcnRpY2xlVWlkIHdpdGggYXJ0aWNsZUlkJyk7XG4gICAgaWYgKHRoaXMuYnlMb2NhdGlvbikgdGhyb3cgRXJyb3IoJ0RvIG5vdCB1c2UgYXJ0aWNsZVVpZCB3aXRoIGJ5TG9jYXRpb24nKTtcblxuICAgIGlmICh0aGlzLl9hcnRpY2xlVWlkID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgdGhpcy5fYXJ0aWNsZVVpZCA9IHZhbHVlO1xuXG4gICAgaWYgKCF2YWx1ZSkgcmV0dXJuO1xuICAgIHRoaXMuX2FwaS5nZXRBcnRpY2xlQnlVaWQobG9jYXRpb24ub3JpZ2luLCB2YWx1ZSkuc3Vic2NyaWJlKFxuICAgICAgYXJ0aWNsZSA9PiAodGhpcy5hcnRpY2xlID0gYXJ0aWNsZSksXG4gICAgICAoKSA9PiAodGhpcy5hcnRpY2xlID0gbnVsbCksXG4gICAgKTtcbiAgfVxuXG4gIEBJbnB1dCgpXG4gIGdldCBieUxvY2F0aW9uKCk6IGJvb2xlYW4ge1xuICAgIHJldHVybiB0aGlzLl9ieUxvY2F0aW9uO1xuICB9XG4gIHNldCBieUxvY2F0aW9uKHZhbHVlOiBib29sZWFuKSB7XG4gICAgaWYgKHRoaXMuYXJ0aWNsZUlkKSB0aHJvdyBFcnJvcignRG8gbm90IHVzZSBieUxvY2F0aW9uIHdpdGggYXJ0aWNsZUlkJyk7XG4gICAgaWYgKHRoaXMuYXJ0aWNsZVVpZCkgdGhyb3cgRXJyb3IoJ0RvIG5vdCB1c2UgYnlMb2NhdGlvbiB3aXRoIGFydGljbGVVaWQnKTtcblxuICAgIGlmICh0aGlzLl9ieUxvY2F0aW9uID09PSB2YWx1ZSkgcmV0dXJuO1xuXG4gICAgdGhpcy5fYnlMb2NhdGlvbiA9IHZhbHVlO1xuXG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICB0aGlzLnVwZGF0ZUZyb21Mb2NhdGlvbigpO1xuICAgICAgdGhpcy5fcm91dGVyRXZlbnRzU3Vic2NyaXB0aW9uID0gdGhpcy5fcm91dGVyLmV2ZW50c1xuICAgICAgICAucGlwZShmaWx0ZXIoZXZlbnQgPT4gZXZlbnQgaW5zdGFuY2VvZiBOYXZpZ2F0aW9uRW5kKSlcbiAgICAgICAgLnN1YnNjcmliZSgoKSA9PiB7XG4gICAgICAgICAgdGhpcy51cGRhdGVGcm9tTG9jYXRpb24oKTtcbiAgICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3JvdXRlckV2ZW50c1N1YnNjcmlwdGlvbj8udW5zdWJzY3JpYmUoKTtcbiAgICB9XG4gIH1cblxuICBASW5wdXQoKVxuICBhbHdheXNWaXNpYmxlOiBib29sZWFuID0gdHJ1ZTtcblxuICBASW5wdXQoKVxuICBpbmxpbmU6IGJvb2xlYW4gPSBmYWxzZTtcblxuICBAVmlld0NoaWxkKCdoZWxwUXVlc3Rpb24nLCB7IHN0YXRpYzogdHJ1ZSB9KVxuICBwcml2YXRlIF9oZWxwUXVlc3Rpb25FbGVtZW50OiBFbGVtZW50UmVmO1xuXG4gIHByaXZhdGUgX292ZXJsYXlSZWY6IE92ZXJsYXlSZWY7XG4gIHByaXZhdGUgX3BvcnRhbDogQ29tcG9uZW50UG9ydGFsPEhlbHBFeHRGbHlvdXRDb21wb25lbnQ+O1xuICBwcml2YXRlIF9mbHlvdXRJbnN0YW5jZTogSGVscEV4dEZseW91dENvbXBvbmVudDtcblxuICBwcml2YXRlIF9vbkRlc3Ryb3kgPSBuZXcgU3ViamVjdDx2b2lkPigpO1xuXG4gIHByaXZhdGUgX3Nob3dUaW1lb3V0SWQ6IFJldHVyblR5cGU8dHlwZW9mIHNldFRpbWVvdXQ+IHwgdW5kZWZpbmVkO1xuICBwcml2YXRlIF9oaWRlVGltZW91dElkOiBSZXR1cm5UeXBlPHR5cGVvZiBzZXRUaW1lb3V0PiB8IHVuZGVmaW5lZDtcblxuICBASG9zdExpc3RlbmVyKCdtb3VzZWVudGVyJylcbiAgX29uTW91c2VFbnRlcigpIHtcbiAgICBpZiAoIXRoaXMuYXJ0aWNsZSkgcmV0dXJuO1xuXG4gICAgdGhpcy5zaG93KEZMWU9VVF9TSE9XX0hJREVfREVMQVkpO1xuICB9XG5cbiAgQEhvc3RMaXN0ZW5lcignbW91c2VsZWF2ZScpXG4gIF9vbk1vdXNlTGVhdmUoKSB7XG4gICAgdGhpcy5oaWRlKEZMWU9VVF9TSE9XX0hJREVfREVMQVkpO1xuICB9XG5cbiAgcHJpdmF0ZSBzaG93KGRlbGF5OiBudW1iZXIpOiB2b2lkIHtcbiAgICBjbGVhclRpbWVvdXQodGhpcy5faGlkZVRpbWVvdXRJZCk7XG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX3Nob3dUaW1lb3V0SWQpO1xuICAgIGlmICh0aGlzLl9mbHlvdXRJbnN0YW5jZSkgcmV0dXJuO1xuXG4gICAgdGhpcy5fc2hvd1RpbWVvdXRJZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgdGhpcy5fZmx5b3V0SW5zdGFuY2UgPSB0aGlzLl9vdmVybGF5UmVmLmF0dGFjaCh0aGlzLl9wb3J0YWwpLmluc3RhbmNlO1xuICAgICAgdGhpcy5fZmx5b3V0SW5zdGFuY2UuYXJ0aWNsZSA9IHRoaXMuYXJ0aWNsZTtcbiAgICAgIHRoaXMuX2ZseW91dEluc3RhbmNlLm1vdXNlRW50ZXIuc3Vic2NyaWJlKCgpID0+IHRoaXMuc2hvdyhGTFlPVVRfU0hPV19ISURFX0RFTEFZKSk7XG4gICAgICB0aGlzLl9mbHlvdXRJbnN0YW5jZS5tb3VzZUxlYXZlLnN1YnNjcmliZSgoKSA9PiB0aGlzLmhpZGUoRkxZT1VUX1NIT1dfSElERV9ERUxBWSkpO1xuICAgICAgdGhpcy5fZmx5b3V0SW5zdGFuY2Uuc2hvdygpO1xuXG4gICAgICB0aGlzLl9zaG93VGltZW91dElkID0gdW5kZWZpbmVkO1xuICAgIH0sIGRlbGF5KTtcbiAgfVxuXG4gIHByaXZhdGUgaGlkZShkZWxheTogbnVtYmVyKTogdm9pZCB7XG4gICAgY2xlYXJUaW1lb3V0KHRoaXMuX2hpZGVUaW1lb3V0SWQpO1xuICAgIGNsZWFyVGltZW91dCh0aGlzLl9zaG93VGltZW91dElkKTtcbiAgICBpZiAoIXRoaXMuX2ZseW91dEluc3RhbmNlKSByZXR1cm47XG5cbiAgICB0aGlzLl9oaWRlVGltZW91dElkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB0aGlzLl9oaWRlVGltZW91dElkID0gdW5kZWZpbmVkO1xuXG4gICAgICB0aGlzLl9mbHlvdXRJbnN0YW5jZS5oaWRlKCk7XG4gICAgICB0aGlzLl9mbHlvdXRJbnN0YW5jZS5hZnRlckhpZGRlbi5zdWJzY3JpYmUoKCkgPT4ge1xuICAgICAgICB0aGlzLl9vdmVybGF5UmVmLmRldGFjaCgpO1xuICAgICAgICB0aGlzLl9mbHlvdXRJbnN0YW5jZSA9IHVuZGVmaW5lZDtcbiAgICAgIH0pO1xuICAgIH0sIGRlbGF5KTtcbiAgfVxuXG4gIGNvbnN0cnVjdG9yKFxuICAgIHByaXZhdGUgcmVhZG9ubHkgX2NkcjogQ2hhbmdlRGV0ZWN0b3JSZWYsXG4gICAgcHJpdmF0ZSByZWFkb25seSBfcm91dGVyOiBSb3V0ZXIsXG4gICAgcHJpdmF0ZSByZWFkb25seSBfb3ZlcmxheTogT3ZlcmxheSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9hcGk6IEhlbHBFeHRTZXJ2aWNlLFxuICAgIHByaXZhdGUgcmVhZG9ubHkgX3ZpZXdwb3J0UnVsZXI6IFZpZXdwb3J0UnVsZXIsXG4gICAgQEluamVjdChET0NVTUVOVCkgcHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnQ6IGFueSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9wbGF0Zm9ybTogUGxhdGZvcm0sXG4gICAgcHJpdmF0ZSByZWFkb25seSBfb3ZlcmxheUNvbnRhaW5lcjogT3ZlcmxheUNvbnRhaW5lcixcbiAgKSB7fVxuXG4gIG5nT25Jbml0KCk6IHZvaWQge1xuICAgIHRoaXMuX3BvcnRhbCA9IG5ldyBDb21wb25lbnRQb3J0YWwoSGVscEV4dEZseW91dENvbXBvbmVudCk7XG5cbiAgICBjb25zdCBwb3NpdGlvblN0cmF0ZWd5ID0gbmV3IEZsZXhpYmxlQ29ubmVjdGVkUG9zaXRpb25TdHJhdGVneTE3KFxuICAgICAgdGhpcy5faGVscFF1ZXN0aW9uRWxlbWVudCxcbiAgICAgIHRoaXMuX3ZpZXdwb3J0UnVsZXIsXG4gICAgICB0aGlzLl9kb2N1bWVudCxcbiAgICAgIHRoaXMuX3BsYXRmb3JtLFxuICAgICAgdGhpcy5fb3ZlcmxheUNvbnRhaW5lcixcbiAgICApXG4gICAgICAud2l0aEZsZXhpYmxlRGltZW5zaW9ucyh0cnVlKVxuICAgICAgLndpdGhHcm93QWZ0ZXJPcGVuKHRydWUpXG4gICAgICAud2l0aFB1c2godHJ1ZSlcbiAgICAgIC53aXRoUG9zaXRpb25zKFtcbiAgICAgICAgeyBvcmlnaW5YOiAnY2VudGVyJywgb3JpZ2luWTogJ2JvdHRvbScsIG92ZXJsYXlYOiAnY2VudGVyJywgb3ZlcmxheVk6ICd0b3AnIH0sIC8vIGJvdHRvbVxuICAgICAgICB7IG9yaWdpblg6ICdlbmQnLCBvcmlnaW5ZOiAnY2VudGVyJywgb3ZlcmxheVg6ICdzdGFydCcsIG92ZXJsYXlZOiAnY2VudGVyJyB9LCAvLyByaWdodFxuICAgICAgICB7IG9yaWdpblg6ICdzdGFydCcsIG9yaWdpblk6ICdjZW50ZXInLCBvdmVybGF5WDogJ2VuZCcsIG92ZXJsYXlZOiAnY2VudGVyJyB9LCAvLyBsZWZ0XG4gICAgICAgIHsgb3JpZ2luWDogJ2VuZCcsIG9yaWdpblk6ICdjZW50ZXInLCBvdmVybGF5WDogJ3N0YXJ0Jywgb3ZlcmxheVk6ICd0b3AnIH0sIC8vIGZvcmNlIHJpZ2h0XG4gICAgICAgIHsgb3JpZ2luWDogJ3N0YXJ0Jywgb3JpZ2luWTogJ2NlbnRlcicsIG92ZXJsYXlYOiAnZW5kJywgb3ZlcmxheVk6ICd0b3AnIH0sIC8vIGZvcmNlIGxlZnRcbiAgICAgICAgeyBvcmlnaW5YOiAnY2VudGVyJywgb3JpZ2luWTogJ3RvcCcsIG92ZXJsYXlYOiAnY2VudGVyJywgb3ZlcmxheVk6ICdib3R0b20nIH0sIC8vIHRvcFxuICAgICAgXSk7XG4gICAgY29uc3Qgc2Nyb2xsU3RyYXRlZ3kgPSB0aGlzLl9vdmVybGF5LnNjcm9sbFN0cmF0ZWdpZXMucmVwb3NpdGlvbigpO1xuICAgIHRoaXMuX292ZXJsYXlSZWYgPSB0aGlzLl9vdmVybGF5LmNyZWF0ZSh7XG4gICAgICBwb3NpdGlvblN0cmF0ZWd5OiBwb3NpdGlvblN0cmF0ZWd5LFxuICAgICAgc2Nyb2xsU3RyYXRlZ3k6IHNjcm9sbFN0cmF0ZWd5LFxuICAgICAgLy9tYXhIZWlnaHQ6IHdpbmRvdy5pbm5lckhlaWdodCAtIHRoaXMuX2hlbHBRdWVzdGlvbkVsZW1lbnQubmF0aXZlRWxlbWVudC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKS5ib3R0b20sXG4gICAgICBtYXhXaWR0aDogJ21pbig5MjBweCwgMTAwdncpJyxcbiAgICAgIHBhbmVsQ2xhc3M6ICdoZWxwLWV4dC1wYW5lbCcsXG4gICAgfSk7XG4gIH1cblxuICBuZ09uRGVzdHJveSgpOiB2b2lkIHtcbiAgICB0aGlzLl9vbkRlc3Ryb3kubmV4dCgpO1xuICAgIHRoaXMuX29uRGVzdHJveS5jb21wbGV0ZSgpO1xuICAgIHRoaXMuX3JvdXRlckV2ZW50c1N1YnNjcmlwdGlvbj8udW5zdWJzY3JpYmUoKTtcbiAgfVxuXG4gIHByaXZhdGUgdXBkYXRlRnJvbUxvY2F0aW9uKCk6IHZvaWQge1xuICAgIHRoaXMuX2FwaS5nZXRBcnRpY2xlQnlVcmwobG9jYXRpb24ub3JpZ2luICsgbG9jYXRpb24ucGF0aG5hbWUpLnN1YnNjcmliZShcbiAgICAgIGFydGljbGUgPT4gKHRoaXMuYXJ0aWNsZSA9IGFydGljbGUpLFxuICAgICAgKCkgPT4gKHRoaXMuYXJ0aWNsZSA9IG51bGwpLFxuICAgICk7XG4gIH1cbn1cbiJdfQ==