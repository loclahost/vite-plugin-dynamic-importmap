# vite-plugin-dynamic-importmap

Dynamic [Subresource Integrity](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity) for [Vue 3](https://vuejs.org/) in [Vite](https://vitejs.dev/)
since it does not yet [support it natively](https://github.com/vitejs/vite/issues/2377).

This plugin works in two steps:

1. It will inject the union of the supplied and calculated integrity map into the chunk where the vue runtime-dom code does its dynamic loading and add integrity attributes from that map to all preloads
2. It will look up any strings on index.html that is also a key in the integrity map and add the integrity attribute to them

## Requirement

-   Vite >= 6
-   Nodejs >= 23
-   Vue >= 3

## Usage

```javascript
// vite.config.(js|ts|mjs|mts)
import { defineConfig } from 'vite';
import { dynamicImportMap } from './vite-plugin-dynamic-importmap';

export default defineConfig({
	plugins: [dynamicImportMap()],
});
```

## Configuration

-   `externalResourceIntegrities`
    All generated chunks will automatically get their identity calculated but if your code depends on external sources you can include their identity here

Default: `undefined`

```javascript
dynamicImportMap({
	externalResourceIntegrities: {
		'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css': 'sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH',
		'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js':
			'sha384-YvpcrYf0tY3lHB60NNkmXc5s9fDVZLESaAA55NDzOxhy9GkcIdslK1eN7N6jIeHz',
	},
});
```

## Thanks

Thanks to @yoyo930021 and his plugin [`yoyo930021/vite-plugin-sri3`](https://github.com/yoyo930021/vite-plugin-sri3) upon which this is based
