import { createHash } from 'crypto';
import type { Plugin, HookHandler } from 'vite';
import { OutputAsset, OutputBundle, OutputChunk } from 'rollup';

const VITE_INTERNAL_ANALYSIS_PLUGIN = 'vite:build-import-analysis';

export type GenerateBundle = HookHandler<Plugin['generateBundle']>;

export interface ImportMapConfiguration {
	externalResourceIntegrities?: { [key: string]: string };
}

export function dynamicImportMap(pluginConfiguration: ImportMapConfiguration): Plugin {
	function hijackGenerateBundle(plugin: Plugin, afterHook: GenerateBundle) {
		const hook = plugin.generateBundle;
		if (typeof hook === 'object' && hook.handler) {
			const fn = hook.handler;
			hook.handler = async function (this, ...args) {
				await fn.apply(this, args);
				await afterHook?.apply(this, args);
			};
		}
		if (typeof hook === 'function') {
			plugin.generateBundle = async function (this, ...args) {
				await hook.apply(this, args);
				await afterHook?.apply(this, args);
			};
		}
	}

	return {
		name: 'vite-plugin-dynamic-importmap',
		apply: 'build',
		enforce: 'post',
		configResolved(config) {
			const calculateBundleItemIntegrity = (bundleItem: OutputChunk | OutputAsset) => {
				let source = bundleItem.type === 'chunk' ? bundleItem.code : bundleItem.source;

				return `sha384-${createHash('sha384').update(source).digest().toString('base64')}`;
			};

			const calculateBundleIntegrityAttributes = (bundle: OutputBundle): { [key: string]: string } => {
				let integrity = structuredClone(pluginConfiguration?.externalResourceIntegrities || {});
				Object.values(bundle)
					.filter((bundleItem) => bundleItem.fileName != 'index.html')
					.map((bundleItem) => ({
						fileName: '/' + bundleItem.fileName,
						type: bundleItem.type,
						integrity: calculateBundleItemIntegrity(bundleItem),
					}))
					.forEach((bundleItemIntegrity) => (integrity[bundleItemIntegrity.fileName] = bundleItemIntegrity.integrity));

				return integrity;
			};

			const injectIntegrityMap = (preloadJsChunk: OutputChunk, integrityMap: string) => {
				preloadJsChunk.code = preloadJsChunk.code
					.toString()
					.replace('getAttribute("nonce");', 'getAttribute("nounce"); let integrityMap=' + integrityMap + ';');
			};

			const injectSetIntegrityAttribute = (preloadJsChunk: OutputChunk) => {
				const minifiedNames = preloadJsChunk.code.toString().match(/href=(\w+),(\w+)&&(\w+)\.setAttribute\("nonce"/);
				if (!minifiedNames || minifiedNames.length != 4) {
					throw new Error('Could not find minified names to inject into');
				}

				preloadJsChunk.code = preloadJsChunk.code
					.toString()
					.replace(
						'href=' + minifiedNames[1] + ',' + minifiedNames[2] + '&&' + minifiedNames[3] + '.setAttribute("nonce"',
						'href=' +
							minifiedNames[1] +
							',' +
							minifiedNames[3] +
							'.setAttribute("integrity", integrityMap[' +
							minifiedNames[1] +
							']),' +
							minifiedNames[2] +
							'&&' +
							minifiedNames[3] +
							'.setAttribute("nonce"'
					);
			};

			const updatePrerenderedImports = (bundle: OutputBundle) => {
				let indexAsset = bundle['index.html'] as OutputAsset;
				// Recalculate interity as previos steps most likely have changed the content of some chunks
				let integrityMap = calculateBundleIntegrityAttributes(bundle);

				let indexHtml = indexAsset.source.toString();
				for (const [fileName, integrity] of Object.entries(integrityMap)) {
					indexHtml = indexHtml.replace('"' + fileName + '"', '"' + fileName + '" integrity="' + integrity + '"');
				}
				indexAsset.source = indexHtml;
			};

			const generateIntegrityMap: Plugin['generateBundle'] = async function (_, bundle) {
				let integrity = calculateBundleIntegrityAttributes(bundle);

				let preloadCodeChunk = Object.values(bundle)
					.filter((bundleItem) => bundleItem.type == 'chunk')
					.find((chunk) => chunk.code.includes('getAttribute("nonce");')) as OutputChunk;

				injectIntegrityMap(preloadCodeChunk, JSON.stringify(integrity));

				injectSetIntegrityAttribute(preloadCodeChunk);

				updatePrerenderedImports(bundle);
			};

			const plugin = config.plugins.find((p) => p.name === VITE_INTERNAL_ANALYSIS_PLUGIN);

			if (!plugin) {
				throw new Error('Hook plugin not found');
			}

			hijackGenerateBundle(plugin, generateIntegrityMap);
		},
	};
}
