import { HttpClient } from '@angular/common/http';
import { ElementRef } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { HelpExtHttpHeaders, HelpExtUrlResolver } from '../help-ext.config';
import { Article } from './article';
export declare const cacheLifetimeSecondDefault: number;
export declare class HelpExtService {
    private readonly _http;
    private readonly _sanitizer;
    private readonly _httpHeaders;
    private readonly cacheLifetime;
    private readonly cacheById;
    private readonly requestCacheById;
    private readonly cacheByUid;
    private readonly requestCacheByUid;
    private readonly cacheByUrl;
    private readonly requestCacheByUrl;
    readonly baseAddress: Observable<string>;
    constructor(helpExtUrlResolver: HelpExtUrlResolver, _http: HttpClient, _sanitizer: DomSanitizer, helpExtUrl: string, cacheLifetimeSecond: number, _httpHeaders: HelpExtHttpHeaders);
    getArticleById(id: number): Observable<Article>;
    getArticleByUid(siteOrigin: string, uid: string): Observable<Article>;
    getArticleByUrl(url: string): Observable<Article>;
    sanitizeContent(content: string): string;
    makeAbsoluteLinks(element: Element | ElementRef, baseAddress: string, linkTarget?: string): void;
    private cachedGet;
}
