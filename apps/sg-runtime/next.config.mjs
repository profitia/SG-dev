import path from 'node:path'
import { fileURLToPath } from 'node:url'
import createNextIntlPlugin from 'next-intl/plugin'
import { withSentryConfig } from '@sentry/nextjs/config'

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
	experimental: { instrumentationHook: true },
	env: {
		NEXT_PUBLIC_SENTRY_ENABLED: process.env.SENTRY_ENABLED ?? 'false',
		NEXT_PUBLIC_SENTRY_SCOPE: process.env.SENTRY_SCOPE ?? '',
		NEXT_PUBLIC_SENTRY_DSN: process.env.SENTRY_DSN ?? '',
		NEXT_PUBLIC_SENTRY_PROJECT_ID: process.env.SENTRY_PROJECT_ID ?? '',
		NEXT_PUBLIC_SENTRY_ENVIRONMENT: process.env.APP_ENV ?? '',
		NEXT_PUBLIC_SENTRY_RELEASE: process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT ?? '',
		NEXT_PUBLIC_SENTRY_SERVICE: process.env.RENDER_SERVICE_NAME ?? '',
		NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1',
		NEXT_PUBLIC_SENTRY_PRODUCTION_APPROVED: process.env.SENTRY_PRODUCTION_APPROVED ?? 'false',
	},
	transpilePackages: ['@profitia/srm-xray', '@profitia/srm-adp-ui', '@profitia/sg2-price-change-index-ui'],
	webpack: runtimeAliasWebpack,
}

export default withSentryConfig(withNextIntl(nextConfig), {
	org: process.env.SENTRY_ORG,
	project: process.env.SENTRY_PROJECT,
	silent: true,
	telemetry: false,
	sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN, deleteSourcemapsAfterUpload: true },
	release: { create: Boolean(process.env.SENTRY_AUTH_TOKEN), name: process.env.SENTRY_RELEASE ?? process.env.RENDER_GIT_COMMIT },
})
