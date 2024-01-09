import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, Input } from '@angular/core';
import { HelpExtService } from '../api/help-ext.service';
export class HelpExtArticleContentComponent {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscC1leHQtYXJ0aWNsZS1jb250ZW50LmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL25neC1oZWxwLWV4dC9zcmMvbGliL2hlbHAtZXh0LWFydGljbGUtY29udGVudC9oZWxwLWV4dC1hcnRpY2xlLWNvbnRlbnQuY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxpQkFBaUIsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxNQUFNLGVBQWUsQ0FBQztBQUV6RyxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0seUJBQXlCLENBQUM7QUFPekQsTUFBTSxPQUFPLDhCQUE4QjtJQW1CekMsWUFDbUIsR0FBZSxFQUNmLElBQW9CLEVBQ3BCLElBQXVCO1FBRnZCLFFBQUcsR0FBSCxHQUFHLENBQVk7UUFDZixTQUFJLEdBQUosSUFBSSxDQUFnQjtRQUNwQixTQUFJLEdBQUosSUFBSSxDQUFtQjtJQUN2QyxDQUFDO0lBdEJKOzs7T0FHRztJQUNILElBQ0ksT0FBTyxDQUFDLEtBQWM7UUFDeEIsSUFBSSxDQUFDLE9BQU8sR0FBRyxLQUFLLGFBQUwsS0FBSyx1QkFBTCxLQUFLLENBQUUsT0FBTyxDQUFDO0lBQ2hDLENBQUM7SUFFRCxJQUNJLE9BQU8sQ0FBQyxLQUFhO1FBQ3ZCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUM1QyxJQUFJLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxTQUFTLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDcEUsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUM3RCxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO1FBQzNCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQzs7O1lBdEJGLFNBQVMsU0FBQztnQkFDVCxRQUFRLEVBQUUsMEJBQTBCO2dCQUNwQyxRQUFRLEVBQUUsRUFBRTtnQkFDWixlQUFlLEVBQUUsdUJBQXVCLENBQUMsTUFBTTthQUNoRDs7O1lBUitELFVBQVU7WUFFakUsY0FBYztZQUZXLGlCQUFpQjs7O3NCQWNoRCxLQUFLO3NCQUtMLEtBQUsiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSwgQ2hhbmdlRGV0ZWN0b3JSZWYsIENvbXBvbmVudCwgRWxlbWVudFJlZiwgSW5wdXQgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IEFydGljbGUgfSBmcm9tICcuLi9hcGkvYXJ0aWNsZSc7XG5pbXBvcnQgeyBIZWxwRXh0U2VydmljZSB9IGZyb20gJy4uL2FwaS9oZWxwLWV4dC5zZXJ2aWNlJztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnaGVscC1leHQtYXJ0aWNsZS1jb250ZW50JyxcbiAgdGVtcGxhdGU6ICcnLFxuICBjaGFuZ2VEZXRlY3Rpb246IENoYW5nZURldGVjdGlvblN0cmF0ZWd5Lk9uUHVzaCxcbn0pXG5leHBvcnQgY2xhc3MgSGVscEV4dEFydGljbGVDb250ZW50Q29tcG9uZW50IHtcbiAgLyoqXG4gICAqIEBkZXByZWNhdGVkIFVzZSBjb250ZW50IGluc3RlYWRcbiAgICogQHNlZSBgY29udGVudGBcbiAgICovXG4gIEBJbnB1dCgpXG4gIHNldCBhcnRpY2xlKHZhbHVlOiBBcnRpY2xlKSB7XG4gICAgdGhpcy5jb250ZW50ID0gdmFsdWU/LmNvbnRlbnQ7XG4gIH1cblxuICBASW5wdXQoKVxuICBzZXQgY29udGVudCh2YWx1ZTogc3RyaW5nKSB7XG4gICAgdGhpcy5fYXBpLmJhc2VBZGRyZXNzLnN1YnNjcmliZShiYXNlQWRkcmVzcyA9PiB7XG4gICAgICB0aGlzLl9lbC5uYXRpdmVFbGVtZW50LmlubmVySFRNTCA9IHRoaXMuX2FwaS5zYW5pdGl6ZUNvbnRlbnQodmFsdWUpO1xuICAgICAgdGhpcy5fYXBpLm1ha2VBYnNvbHV0ZUxpbmtzKHRoaXMuX2VsLCBiYXNlQWRkcmVzcywgJ19ibGFuaycpO1xuICAgICAgdGhpcy5fY2RyLm1hcmtGb3JDaGVjaygpO1xuICAgIH0pO1xuICB9XG5cbiAgY29uc3RydWN0b3IoXG4gICAgcHJpdmF0ZSByZWFkb25seSBfZWw6IEVsZW1lbnRSZWYsXG4gICAgcHJpdmF0ZSByZWFkb25seSBfYXBpOiBIZWxwRXh0U2VydmljZSxcbiAgICBwcml2YXRlIHJlYWRvbmx5IF9jZHI6IENoYW5nZURldGVjdG9yUmVmLFxuICApIHt9XG59XG4iXX0=