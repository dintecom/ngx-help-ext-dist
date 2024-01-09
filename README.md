# ngx-help-ext

## Install

- `npm install @dintecom/ngx-help-ext`
- install `npm install @angular/cdk` - peer dependencies of ngx-help-ext

## Setup

### Add CSS

- If you are using sass you can import the css

```scss
@import "~@dintecom/ngx-help-ext/default";
```

- If you are using angular-cli you can add it to your angular.json

```json
"styles": [
  "node_modules/@dintecom/ngx-help-ext/default.css"
]
```

- You can also customize the theme

```scss
@import "~@dintecom/ngx-help-ext/scss/variables";
@import "~@dintecom/ngx-help-ext/scss/help-ext-core";
@import "~@dintecom/ngx-help-ext/scss/mixins/help-ext-theme";
@include help-ext-theme(
  $icon-color: map-get($help-ext-light-theme-foreground, icon),
  $link-color: map-get($help-ext-light-theme-foreground, link),
  $caption-color: map-get($help-ext-light-theme-foreground, caption),
  $border-color: map-get($help-ext-light-theme-foreground, border),
  $code-background-color: map-get($help-ext-light-theme-background, code),
  $flyout-color: map-get($help-ext-light-theme-foreground, text),
  $flyout-background-color: map-get($help-ext-light-theme-background, background),
  $flyout-box-shadow: map-get($help-ext-light-theme-background, shadow)
);
```

- If you are using Angular Material themes

```scss
@import "~@dintecom/ngx-help-ext/scss/help-ext-core";
@import "~@dintecom/ngx-help-ext/scss/mixins/mat-help-ext-theme";
@mixin define-theme($theme) {
  ...
  @include mat-help-ext-theme($theme);
}
```

### Add HelpExtModule to app NgModule

```typescript
import { HelpExtModule } from 'ngx-help-ext';
...

@NgModule({
  ...
  imports: [
    ...
    HelpExtModule.forRoot({
        helpExtUrl: 'https://helpext.com',
    }),
  ],
})
export class AppModule { }
```

### Configure HelpExt address resolver

```typescript
import { HelpExtModule, HelpExtUrlResolver } from 'ngx-help-ext';
...

export class CustomHelpExtUrlResolver implements HelpExtUrlResolver {
  constructor(private readonly config: ConfigService) { }

  resolve(): string {
    return this.config.getHelpExtUrl();
  }

  // Or use Observable
  resolve(): Observable<string> {
    return this.config.getHelpExtUrlAsync();
  }
}

@NgModule({
  ...
  imports: [
    ...
    HelpExtModule.forRoot({
      helpExtUrlResolver: {
        provide: HelpExtUrlResolver,
        useClass: CustomHelpExtUrlResolver,
        deps: [ConfigService],
      },
    }),
  ],
})
export class AppModule { }
```

### Configure cache lifetime

```typescript
@NgModule({
  ...
  imports: [
    ...
    HelpExtModule.forRoot({
      ...
      cacheLifetimeSecond: 10 * 60, // 10 minutes
    }),
  ],
})
export class AppModule { }
```

### Add HTTP headers (example for [@ngx-loading-bar](https://github.com/aitboudad/ngx-loading-bar))

```typescript
@NgModule({
  ...
  imports: [
    ...
    HelpExtModule.forRoot({
      ...
      httpHeaders: {
        ignoreLoadingBar: '',
      },
    }),
  ],
})
export class AppModule { }
```

### SharedModule

If you use a [`SharedModule`](https://angular.io/guide/sharing-ngmodules) that you import in multiple other feature modules,
you can export the `HelpExtModule` to make sure you don't have to import it in every module.

```typescript
@NgModule({
  exports: [
    CommonModule,
    HelpExtModule,
  ],
})
export class SharedModule { }
```

> Note: Never call a `forRoot` static method in the `SharedModule`.

## Usage

```html
<help-ext articleId="1"></help-ext>
<help-ext articleUid="article-uid"></help-ext>
<help-ext [byLocation]="true"></help-ext>
```

## Options

| Name          | Type   | Description                                                                                   | Default |
| ------------- | ------ | --------------------------------------------------------------------------------------------- | ------- |
| articleId     | @Input | Get article by ID.                                                                            | null    |
| articleUid    | @Input | Get article by UID.                                                                           | null    |
| byLocation    | @Input | Get article by current page URL. Automatic subscribe on router NavigationEnd event.           | false   |
| alwaysVisible | @Input | Show dimmed if the article failed to load.                                                    | true    |
| inline        | @Input | Automatically sizing the icon to match the font size of the element the icon is contained in. | false   |
