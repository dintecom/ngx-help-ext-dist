import { AnimationEvent } from '@angular/animations';
import { EventEmitter } from '@angular/core';
import { Article } from '../api/article';
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
}
