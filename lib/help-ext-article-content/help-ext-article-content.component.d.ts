import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { Article } from '../api/article';
import { HelpExtService } from '../api/help-ext.service';
export declare class HelpExtArticleContentComponent {
    private readonly _el;
    private readonly _api;
    private readonly _cdr;
    /**
     * @deprecated Use content instead
     * @see `content`
     */
    set article(value: Article);
    set content(value: string);
    constructor(_el: ElementRef, _api: HelpExtService, _cdr: ChangeDetectorRef);
}
