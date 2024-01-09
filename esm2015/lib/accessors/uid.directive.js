import { Directive, Input } from '@angular/core';
import { HelpExtService } from '../api/help-ext.service';
import { HelpExtArticleContentComponent } from '../help-ext-article-content/help-ext-article-content.component';
export class HelpExtUidDirective {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidWlkLmRpcmVjdGl2ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL3Byb2plY3RzL25neC1oZWxwLWV4dC9zcmMvbGliL2FjY2Vzc29ycy91aWQuZGlyZWN0aXZlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQ2pELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUN6RCxPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQU1oSCxNQUFNLE9BQU8sbUJBQW1CO0lBUzlCLFlBQTZCLElBQW9CLEVBQW1CLEtBQXFDO1FBQTVFLFNBQUksR0FBSixJQUFJLENBQWdCO1FBQW1CLFVBQUssR0FBTCxLQUFLLENBQWdDO0lBQUcsQ0FBQztJQVI3RyxJQUNJLEdBQUcsQ0FBQyxLQUFhO1FBQ25CLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLFFBQVEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUMsU0FBUyxDQUN6RCxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDLEVBQ3pDLEdBQUcsRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLENBQ2xDLENBQUM7SUFDSixDQUFDOzs7WUFYRixTQUFTLFNBQUM7Z0JBQ1QsUUFBUSxFQUFFLCtCQUErQjtnQkFDekMsUUFBUSxFQUFFLFlBQVk7YUFDdkI7OztZQU5RLGNBQWM7WUFDZCw4QkFBOEI7OztrQkFPcEMsS0FBSyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IERpcmVjdGl2ZSwgSW5wdXQgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IEhlbHBFeHRTZXJ2aWNlIH0gZnJvbSAnLi4vYXBpL2hlbHAtZXh0LnNlcnZpY2UnO1xuaW1wb3J0IHsgSGVscEV4dEFydGljbGVDb250ZW50Q29tcG9uZW50IH0gZnJvbSAnLi4vaGVscC1leHQtYXJ0aWNsZS1jb250ZW50L2hlbHAtZXh0LWFydGljbGUtY29udGVudC5jb21wb25lbnQnO1xuXG5ARGlyZWN0aXZlKHtcbiAgc2VsZWN0b3I6ICdoZWxwLWV4dC1hcnRpY2xlLWNvbnRlbnRbdWlkXScsXG4gIGV4cG9ydEFzOiAnaGVscEV4dFVpZCcsXG59KVxuZXhwb3J0IGNsYXNzIEhlbHBFeHRVaWREaXJlY3RpdmUge1xuICBASW5wdXQoKVxuICBzZXQgdWlkKHZhbHVlOiBzdHJpbmcpIHtcbiAgICB0aGlzLl9hcGkuZ2V0QXJ0aWNsZUJ5VWlkKGxvY2F0aW9uLm9yaWdpbiwgdmFsdWUpLnN1YnNjcmliZShcbiAgICAgIGFydGljbGUgPT4gKHRoaXMuX2hvc3QuYXJ0aWNsZSA9IGFydGljbGUpLFxuICAgICAgKCkgPT4gKHRoaXMuX2hvc3QuYXJ0aWNsZSA9IG51bGwpLFxuICAgICk7XG4gIH1cblxuICBjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IF9hcGk6IEhlbHBFeHRTZXJ2aWNlLCBwcml2YXRlIHJlYWRvbmx5IF9ob3N0OiBIZWxwRXh0QXJ0aWNsZUNvbnRlbnRDb21wb25lbnQpIHt9XG59XG4iXX0=