import { ChangeDetectorRef, ElementRef } from '@angular/core';
import { Article } from '../api/article';
import { HelpExtService } from '../api/help-ext.service';
import * as ɵngcc0 from '@angular/core';
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
    static ɵfac: ɵngcc0.ɵɵFactoryDef<HelpExtArticleContentComponent, never>;
    static ɵcmp: ɵngcc0.ɵɵComponentDefWithMeta<HelpExtArticleContentComponent, "help-ext-article-content", never, { "article": "article"; "content": "content"; }, {}, never, never>;
}

//# sourceMappingURL=help-ext-article-content.component.d.ts.map