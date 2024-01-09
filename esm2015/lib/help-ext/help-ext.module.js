import { OverlayModule } from '@angular/cdk/overlay';
import { PortalModule } from '@angular/cdk/portal';
import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { HelpExtUidDirective } from '../accessors/uid.directive';
import { cacheLifetimeSecondDefault, HelpExtService } from '../api/help-ext.service';
import { HelpExtArticleContentComponent } from '../help-ext-article-content/help-ext-article-content.component';
import { HelpExtAttachmentComponent } from '../help-ext-attachment/help-ext-attachment.component';
import { HelpExtFlyoutComponent } from '../help-ext-flyout/help-ext-flyout.component';
import { HelpExtUrlResolver, HELP_EXT_CACHE_LIFETIME_TOKEN, HELP_EXT_HTTP_HEADERS, HELP_EXT_URL_TOKEN, } from '../help-ext.config';
import { HelpExtComponent } from './help-ext.component';
export class HelpExtModule {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscC1leHQubW9kdWxlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vcHJvamVjdHMvbmd4LWhlbHAtZXh0L3NyYy9saWIvaGVscC1leHQvaGVscC1leHQubW9kdWxlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxhQUFhLEVBQUUsTUFBTSxzQkFBc0IsQ0FBQztBQUNyRCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0scUJBQXFCLENBQUM7QUFDbkQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGlCQUFpQixDQUFDO0FBQy9DLE9BQU8sRUFBdUIsUUFBUSxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBQzlELE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxNQUFNLDRCQUE0QixDQUFDO0FBQ2pFLE9BQU8sRUFBRSwwQkFBMEIsRUFBRSxjQUFjLEVBQUUsTUFBTSx5QkFBeUIsQ0FBQztBQUNyRixPQUFPLEVBQUUsOEJBQThCLEVBQUUsTUFBTSxnRUFBZ0UsQ0FBQztBQUNoSCxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxzREFBc0QsQ0FBQztBQUNsRyxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQztBQUN0RixPQUFPLEVBRUwsa0JBQWtCLEVBQ2xCLDZCQUE2QixFQUM3QixxQkFBcUIsRUFDckIsa0JBQWtCLEdBQ25CLE1BQU0sb0JBQW9CLENBQUM7QUFDNUIsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sc0JBQXNCLENBQUM7QUFjeEQsTUFBTSxPQUFPLGFBQWE7SUFDeEIsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFxQjtRQUNsQyxPQUFPO1lBQ0wsUUFBUSxFQUFFLGFBQWE7WUFDdkIsU0FBUyxFQUFFO2dCQUNULE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSxFQUFFLE9BQU8sRUFBRSxrQkFBa0IsRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO2dCQUM1RTtvQkFDRSxPQUFPLEVBQUUsa0JBQWtCO29CQUMzQixRQUFRLEVBQUUsTUFBTSxDQUFDLFVBQVU7aUJBQzVCO2dCQUNEO29CQUNFLE9BQU8sRUFBRSw2QkFBNkI7b0JBQ3RDLFFBQVEsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLG1CQUFtQixDQUFDLENBQUMsQ0FBQyxDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsbUJBQW1CO2lCQUN0RztnQkFDRDtvQkFDRSxPQUFPLEVBQUUscUJBQXFCO29CQUM5QixRQUFRLEVBQUUsTUFBTSxDQUFDLFdBQVc7aUJBQzdCO2dCQUNELGNBQWM7YUFDZjtTQUNGLENBQUM7SUFDSixDQUFDOzs7WUFqQ0YsUUFBUSxTQUFDO2dCQUNSLE9BQU8sRUFBRSxDQUFDLFlBQVksRUFBRSxZQUFZLEVBQUUsYUFBYSxDQUFDO2dCQUNwRCxZQUFZLEVBQUU7b0JBQ1osZ0JBQWdCO29CQUNoQixzQkFBc0I7b0JBQ3RCLDhCQUE4QjtvQkFDOUIsMEJBQTBCO29CQUMxQixtQkFBbUI7aUJBQ3BCO2dCQUNELE9BQU8sRUFBRSxDQUFDLGdCQUFnQixFQUFFLDhCQUE4QixFQUFFLDBCQUEwQixFQUFFLG1CQUFtQixDQUFDO2dCQUM1RyxlQUFlLEVBQUUsQ0FBQyxzQkFBc0IsQ0FBQzthQUMxQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IE92ZXJsYXlNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jZGsvb3ZlcmxheSc7XG5pbXBvcnQgeyBQb3J0YWxNb2R1bGUgfSBmcm9tICdAYW5ndWxhci9jZGsvcG9ydGFsJztcbmltcG9ydCB7IENvbW1vbk1vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvbW1vbic7XG5pbXBvcnQgeyBNb2R1bGVXaXRoUHJvdmlkZXJzLCBOZ01vZHVsZSB9IGZyb20gJ0Bhbmd1bGFyL2NvcmUnO1xuaW1wb3J0IHsgSGVscEV4dFVpZERpcmVjdGl2ZSB9IGZyb20gJy4uL2FjY2Vzc29ycy91aWQuZGlyZWN0aXZlJztcbmltcG9ydCB7IGNhY2hlTGlmZXRpbWVTZWNvbmREZWZhdWx0LCBIZWxwRXh0U2VydmljZSB9IGZyb20gJy4uL2FwaS9oZWxwLWV4dC5zZXJ2aWNlJztcbmltcG9ydCB7IEhlbHBFeHRBcnRpY2xlQ29udGVudENvbXBvbmVudCB9IGZyb20gJy4uL2hlbHAtZXh0LWFydGljbGUtY29udGVudC9oZWxwLWV4dC1hcnRpY2xlLWNvbnRlbnQuY29tcG9uZW50JztcbmltcG9ydCB7IEhlbHBFeHRBdHRhY2htZW50Q29tcG9uZW50IH0gZnJvbSAnLi4vaGVscC1leHQtYXR0YWNobWVudC9oZWxwLWV4dC1hdHRhY2htZW50LmNvbXBvbmVudCc7XG5pbXBvcnQgeyBIZWxwRXh0Rmx5b3V0Q29tcG9uZW50IH0gZnJvbSAnLi4vaGVscC1leHQtZmx5b3V0L2hlbHAtZXh0LWZseW91dC5jb21wb25lbnQnO1xuaW1wb3J0IHtcbiAgSGVscEV4dENvbmZpZyxcbiAgSGVscEV4dFVybFJlc29sdmVyLFxuICBIRUxQX0VYVF9DQUNIRV9MSUZFVElNRV9UT0tFTixcbiAgSEVMUF9FWFRfSFRUUF9IRUFERVJTLFxuICBIRUxQX0VYVF9VUkxfVE9LRU4sXG59IGZyb20gJy4uL2hlbHAtZXh0LmNvbmZpZyc7XG5pbXBvcnQgeyBIZWxwRXh0Q29tcG9uZW50IH0gZnJvbSAnLi9oZWxwLWV4dC5jb21wb25lbnQnO1xuXG5ATmdNb2R1bGUoe1xuICBpbXBvcnRzOiBbQ29tbW9uTW9kdWxlLCBQb3J0YWxNb2R1bGUsIE92ZXJsYXlNb2R1bGVdLFxuICBkZWNsYXJhdGlvbnM6IFtcbiAgICBIZWxwRXh0Q29tcG9uZW50LFxuICAgIEhlbHBFeHRGbHlvdXRDb21wb25lbnQsXG4gICAgSGVscEV4dEFydGljbGVDb250ZW50Q29tcG9uZW50LFxuICAgIEhlbHBFeHRBdHRhY2htZW50Q29tcG9uZW50LFxuICAgIEhlbHBFeHRVaWREaXJlY3RpdmUsXG4gIF0sXG4gIGV4cG9ydHM6IFtIZWxwRXh0Q29tcG9uZW50LCBIZWxwRXh0QXJ0aWNsZUNvbnRlbnRDb21wb25lbnQsIEhlbHBFeHRBdHRhY2htZW50Q29tcG9uZW50LCBIZWxwRXh0VWlkRGlyZWN0aXZlXSxcbiAgZW50cnlDb21wb25lbnRzOiBbSGVscEV4dEZseW91dENvbXBvbmVudF0sXG59KVxuZXhwb3J0IGNsYXNzIEhlbHBFeHRNb2R1bGUge1xuICBzdGF0aWMgZm9yUm9vdChjb25maWc6IEhlbHBFeHRDb25maWcpOiBNb2R1bGVXaXRoUHJvdmlkZXJzPEhlbHBFeHRNb2R1bGU+IHtcbiAgICByZXR1cm4ge1xuICAgICAgbmdNb2R1bGU6IEhlbHBFeHRNb2R1bGUsXG4gICAgICBwcm92aWRlcnM6IFtcbiAgICAgICAgY29uZmlnLmhlbHBFeHRVcmxSZXNvbHZlciB8fCB7IHByb3ZpZGU6IEhlbHBFeHRVcmxSZXNvbHZlciwgdXNlVmFsdWU6IG51bGwgfSxcbiAgICAgICAge1xuICAgICAgICAgIHByb3ZpZGU6IEhFTFBfRVhUX1VSTF9UT0tFTixcbiAgICAgICAgICB1c2VWYWx1ZTogY29uZmlnLmhlbHBFeHRVcmwsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBwcm92aWRlOiBIRUxQX0VYVF9DQUNIRV9MSUZFVElNRV9UT0tFTixcbiAgICAgICAgICB1c2VWYWx1ZTogaXNOYU4oY29uZmlnLmNhY2hlTGlmZXRpbWVTZWNvbmQpID8gY2FjaGVMaWZldGltZVNlY29uZERlZmF1bHQgOiBjb25maWcuY2FjaGVMaWZldGltZVNlY29uZCxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHByb3ZpZGU6IEhFTFBfRVhUX0hUVFBfSEVBREVSUyxcbiAgICAgICAgICB1c2VWYWx1ZTogY29uZmlnLmh0dHBIZWFkZXJzLFxuICAgICAgICB9LFxuICAgICAgICBIZWxwRXh0U2VydmljZSxcbiAgICAgIF0sXG4gICAgfTtcbiAgfVxufVxuIl19