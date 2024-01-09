import { HttpHeaders } from '@angular/common/http';
import { InjectionToken, Provider } from '@angular/core';
import { Observable } from 'rxjs';
export declare abstract class HelpExtUrlResolver {
    abstract resolve(): string | Observable<string>;
}
export declare type HelpExtHttpHeaders = HttpHeaders | {
    [header: string]: string | string[];
};
export interface HelpExtConfig {
    helpExtUrl?: string;
    helpExtUrlResolver?: Provider;
    cacheLifetimeSecond?: number;
    httpHeaders?: HelpExtHttpHeaders;
}
export declare const HELP_EXT_URL_TOKEN: InjectionToken<string>;
export declare const HELP_EXT_CACHE_LIFETIME_TOKEN: InjectionToken<string>;
export declare const HELP_EXT_HTTP_HEADERS: InjectionToken<string>;
