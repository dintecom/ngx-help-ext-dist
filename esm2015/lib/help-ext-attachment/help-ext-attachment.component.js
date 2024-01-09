import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
export class HelpExtAttachmentComponent {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaGVscC1leHQtYXR0YWNobWVudC5jb21wb25lbnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9wcm9qZWN0cy9uZ3gtaGVscC1leHQvc3JjL2xpYi9oZWxwLWV4dC1hdHRhY2htZW50L2hlbHAtZXh0LWF0dGFjaG1lbnQuY29tcG9uZW50LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSx1QkFBdUIsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLE1BQU0sZUFBZSxDQUFDO0FBUTFFLE1BQU0sT0FBTywwQkFBMEI7OztZQUx0QyxTQUFTLFNBQUM7Z0JBQ1QsUUFBUSxFQUFFLHFCQUFxQjtnQkFDL0IsMGxCQUFrRDtnQkFDbEQsZUFBZSxFQUFFLHVCQUF1QixDQUFDLE1BQU07YUFDaEQ7Ozt5QkFFRSxLQUFLIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2hhbmdlRGV0ZWN0aW9uU3RyYXRlZ3ksIENvbXBvbmVudCwgSW5wdXQgfSBmcm9tICdAYW5ndWxhci9jb3JlJztcbmltcG9ydCB7IEF0dGFjaG1lbnQgfSBmcm9tICcuLi9hcGkvYXR0YWNobWVudCc7XG5cbkBDb21wb25lbnQoe1xuICBzZWxlY3RvcjogJ2hlbHAtZXh0LWF0dGFjaG1lbnQnLFxuICB0ZW1wbGF0ZVVybDogJy4vaGVscC1leHQtYXR0YWNobWVudC50ZW1wbGF0ZS5odG1sJyxcbiAgY2hhbmdlRGV0ZWN0aW9uOiBDaGFuZ2VEZXRlY3Rpb25TdHJhdGVneS5PblB1c2gsXG59KVxuZXhwb3J0IGNsYXNzIEhlbHBFeHRBdHRhY2htZW50Q29tcG9uZW50IHtcbiAgQElucHV0KClcbiAgYXR0YWNobWVudDogQXR0YWNobWVudDtcbn1cbiJdfQ==