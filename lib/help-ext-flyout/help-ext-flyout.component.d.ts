import { AnimationEvent } from '@angular/animations';
import { EventEmitter } from '@angular/core';
import { Article } from '../api/article';
import * as ɵngcc0 from '@angular/core';
export declare type FlyoutVisibility = 'initial' | 'visible' | 'hidden';
export declare class HelpExtFlyoutComponent {
    article: Article;
    mouseEnter: EventEmitter<void>;
    mouseLeave: EventEmitter<void>;
    afterHidden: EventEmitter<void>;
    _onMouseEnter(): void;
    _onMouseLeave(): void;
    _visibility: FlyoutVisibility;
    _onStateDone(event: AnimationEvent): void;
    show(): void;
    hide(): void;
    isVisible(): boolean;
    static ɵfac: ɵngcc0.ɵɵFactoryDef<HelpExtFlyoutComponent, never>;
    static ɵcmp: ɵngcc0.ɵɵComponentDefWithMeta<HelpExtFlyoutComponent, "help-ext-flyout", never, { "article": "article"; }, { "mouseEnter": "mouseEnter"; "mouseLeave": "mouseLeave"; "afterHidden": "afterHidden"; }, never, never>;
}

//# sourceMappingURL=help-ext-flyout.component.d.ts.map