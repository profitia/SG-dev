import path from 'node:path'
import { fileURLToPath } from 'node:url'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')
const runtimeRoot = path.dirname(fileURLToPath(import.meta.url))

export const runtimeAliasWebpack = (config) => {
	config.resolve ??= {}
	config.resolve.alias ??= {}
	config.resolve.alias['@'] = runtimeRoot

	return config
}

/** @type {import('next').NextConfig} */
const nextConfig = {
	webpack: runtimeAliasWebpack,
}

export default withNextIntl(nextConfig)