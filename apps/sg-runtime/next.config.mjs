import path from 'node:path'
import { fileURLToPath } from 'node:url'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')
const runtimeRoot = path.dirname(fileURLToPath(import.meta.url))

export const runtimeAliasWebpack = (config) => {
	config.resolve ??= {}
	config.resolve.alias ??= {}
	config.resolve.alias['@'] = runtimeRoot
	// The public PCI package ships scoped CSS strings for its native ShadowRoot.
	config.module ??= { rules: [] }
	config.module.rules ??= []
	const cssRules = config.module.rules.find(rule => rule && typeof rule === 'object' && Array.isArray(rule.oneOf))
	if (cssRules) cssRules.oneOf.unshift({ test: /\.css$/, resourceQuery: /inline/, type: 'asset/source' })
	else config.module.rules.unshift({ test: /\.css$/, resourceQuery: /inline/, type: 'asset/source' })

	return config
}

/** @type {import('next').NextConfig} */
const nextConfig = {
	transpilePackages: ['@profitia/srm-xray', '@profitia/srm-adp-ui', '@profitia/sg2-price-change-index-ui'],
	webpack: runtimeAliasWebpack,
}

export default withNextIntl(nextConfig)
