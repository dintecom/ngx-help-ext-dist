import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, HostListener, Input, Output, } from '@angular/core';
import { helpExtFlyoutAnimations } from './help-ext-flyout-animations';
export class HelpExtFlyoutComponent {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscC1leHQtZmx5b3V0LmNvbXBvbmVudC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL25neC1oZWxwLWV4dC9zcmMvbGliL2hlbHAtZXh0LWZseW91dC9oZWxwLWV4dC1mbHlvdXQuY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUNBLE9BQU8sRUFDTCx1QkFBdUIsRUFDdkIsU0FBUyxFQUNULFlBQVksRUFDWixXQUFXLEVBQ1gsWUFBWSxFQUNaLEtBQUssRUFDTCxNQUFNLEdBQ1AsTUFBTSxlQUFlLENBQUM7QUFFdkIsT0FBTyxFQUFFLHVCQUF1QixFQUFFLE1BQU0sOEJBQThCLENBQUM7QUFhdkUsTUFBTSxPQUFPLHNCQUFzQjtJQVRuQztRQWNFLGVBQVUsR0FBRyxJQUFJLFlBQVksRUFBUSxDQUFDO1FBR3RDLGVBQVUsR0FBRyxJQUFJLFlBQVksRUFBUSxDQUFDO1FBR3RDLGdCQUFXLEdBQUcsSUFBSSxZQUFZLEVBQVEsQ0FBQztRQWF2QyxnQkFBVyxHQUFxQixTQUFTLENBQUM7SUFzQjVDLENBQUM7SUFoQ0MsYUFBYTtRQUNYLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFLENBQUM7SUFDekIsQ0FBQztJQUdELGFBQWE7UUFDWCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDO0lBQ3pCLENBQUM7SUFNRCxZQUFZLENBQUMsS0FBcUI7UUFDaEMsTUFBTSxPQUFPLEdBQUcsS0FBSyxDQUFDLE9BQTJCLENBQUM7UUFFbEQsSUFBSSxPQUFPLEtBQUssUUFBUSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxFQUFFO1lBQzdDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLENBQUM7U0FDekI7SUFDSCxDQUFDO0lBRUQsSUFBSTtRQUNGLElBQUksQ0FBQyxXQUFXLEdBQUcsU0FBUyxDQUFDO0lBQy9CLENBQUM7SUFFRCxJQUFJO1FBQ0YsSUFBSSxDQUFDLFdBQVcsR0FBRyxRQUFRLENBQUM7SUFDOUIsQ0FBQztJQUVELFNBQVM7UUFDUCxPQUFPLElBQUksQ0FBQyxXQUFXLEtBQUssU0FBUyxDQUFDO0lBQ3hDLENBQUM7OztZQXRERixTQUFTLFNBQUM7Z0JBQ1QsUUFBUSxFQUFFLGlCQUFpQjtnQkFDM0Isa2NBQThDO2dCQUM5QyxVQUFVLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQyxXQUFXLENBQUM7Z0JBQ2pELGVBQWUsRUFBRSx1QkFBdUIsQ0FBQyxNQUFNO2dCQUMvQyxJQUFJLEVBQUU7b0JBQ0osS0FBSyxFQUFFLGlCQUFpQjtpQkFDekI7YUFDRjs7O3NCQUVFLEtBQUs7eUJBR0wsTUFBTTt5QkFHTixNQUFNOzBCQUdOLE1BQU07NEJBR04sWUFBWSxTQUFDLFlBQVk7NEJBS3pCLFlBQVksU0FBQyxZQUFZOzBCQUt6QixXQUFXLFNBQUMsUUFBUTsyQkFHcEIsWUFBWSxTQUFDLGFBQWEsRUFBRSxDQUFDLFFBQVEsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFuaW1hdGlvbkV2ZW50IH0gZnJvbSAnQGFuZ3VsYXIvYW5pbWF0aW9ucyc7XG5pbXBvcnQge1xuICBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneSxcbiAgQ29tcG9uZW50LFxuICBFdmVudEVtaXR0ZXIsXG4gIEhvc3RCaW5kaW5nLFxuICBIb3N0TGlzdGVuZXIsXG4gIElucHV0LFxuICBPdXRwdXQsXG59IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgQXJ0aWNsZSB9IGZyb20gJy4uL2FwaS9hcnRpY2xlJztcbmltcG9ydCB7IGhlbHBFeHRGbHlvdXRBbmltYXRpb25zIH0gZnJvbSAnLi9oZWxwLWV4dC1mbHlvdXQtYW5pbWF0aW9ucyc7XG5cbmV4cG9ydCB0eXBlIEZseW91dFZpc2liaWxpdHkgPSAnaW5pdGlhbCcgfCAndmlzaWJsZScgfCAnaGlkZGVuJztcblxuQENvbXBvbmVudCh7XG4gIHNlbGVjdG9yOiAnaGVscC1leHQtZmx5b3V0JyxcbiAgdGVtcGxhdGVVcmw6ICcuL2hlbHAtZXh0LWZseW91dC50ZW1wbGF0ZS5odG1sJyxcbiAgYW5pbWF0aW9uczogW2hlbHBFeHRGbHlvdXRBbmltYXRpb25zLmZseW91dFN0YXRlXSxcbiAgY2hhbmdlRGV0ZWN0aW9uOiBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5PblB1c2gsXG4gIGhvc3Q6IHtcbiAgICBjbGFzczogJ2hlbHAtZXh0LWZseW91dCcsXG4gIH0sXG59KVxuZXhwb3J0IGNsYXNzIEhlbHBFeHRGbHlvdXRDb21wb25lbnQge1xuICBASW5wdXQoKVxuICBhcnRpY2xlOiBBcnRpY2xlO1xuXG4gIEBPdXRwdXQoKVxuICBtb3VzZUVudGVyID0gbmV3IEV2ZW50RW1pdHRlcjx2b2lkPigpO1xuXG4gIEBPdXRwdXQoKVxuICBtb3VzZUxlYXZlID0gbmV3IEV2ZW50RW1pdHRlcjx2b2lkPigpO1xuXG4gIEBPdXRwdXQoKVxuICBhZnRlckhpZGRlbiA9IG5ldyBFdmVudEVtaXR0ZXI8dm9pZD4oKTtcblxuICBASG9zdExpc3RlbmVyKCdtb3VzZWVudGVyJylcbiAgX29uTW91c2VFbnRlcigpIHtcbiAgICB0aGlzLm1vdXNlRW50ZXIuZW1pdCgpO1xuICB9XG5cbiAgQEhvc3RMaXN0ZW5lcignbW91c2VsZWF2ZScpXG4gIF9vbk1vdXNlTGVhdmUoKSB7XG4gICAgdGhpcy5tb3VzZUxlYXZlLmVtaXQoKTtcbiAgfVxuXG4gIEBIb3N0QmluZGluZygnQHN0YXRlJylcbiAgX3Zpc2liaWxpdHk6IEZseW91dFZpc2liaWxpdHkgPSAnaW5pdGlhbCc7XG5cbiAgQEhvc3RMaXN0ZW5lcignQHN0YXRlLmRvbmUnLCBbJyRldmVudCddKVxuICBfb25TdGF0ZURvbmUoZXZlbnQ6IEFuaW1hdGlvbkV2ZW50KSB7XG4gICAgY29uc3QgdG9TdGF0ZSA9IGV2ZW50LnRvU3RhdGUgYXMgRmx5b3V0VmlzaWJpbGl0eTtcblxuICAgIGlmICh0b1N0YXRlID09PSAnaGlkZGVuJyAmJiAhdGhpcy5pc1Zpc2libGUoKSkge1xuICAgICAgdGhpcy5hZnRlckhpZGRlbi5lbWl0KCk7XG4gICAgfVxuICB9XG5cbiAgc2hvdygpOiB2b2lkIHtcbiAgICB0aGlzLl92aXNpYmlsaXR5ID0gJ3Zpc2libGUnO1xuICB9XG5cbiAgaGlkZSgpOiB2b2lkIHtcbiAgICB0aGlzLl92aXNpYmlsaXR5ID0gJ2hpZGRlbic7XG4gIH1cblxuICBpc1Zpc2libGUoKTogYm9vbGVhbiB7XG4gICAgcmV0dXJuIHRoaXMuX3Zpc2liaWxpdHkgPT09ICd2aXNpYmxlJztcbiAgfVxufVxuIl19