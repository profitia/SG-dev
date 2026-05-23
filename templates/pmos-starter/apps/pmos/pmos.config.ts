/**
 * PMOS Configuration
 * ------------------
 * Edit this file after installing PMOS to describe your project.
 * This config is used by the VSC-BOOTSTRAP-PROMPT and context builder
 * to generate project-specific roadmap, principles, and context.
 */

export const pmosConfig = {
  /**
   * Display name of the project.
   * Used in context file headers and PMOS dashboard.
   */
  projectName: 'My Project',

  /**
   * Project type. Drives roadmap structure suggestions.
   * Options: 'fullstack-web' | 'api' | 'mobile' | 'library' | 'monorepo' | 'cli'
   */
  projectType: 'fullstack-web' as const,

  /**
   * Primary architectural style.
   * Options: 'event-driven' | 'layered' | 'microservices' | 'monolith' | 'serverless' | 'hybrid'
   */
  architectureStyle: 'layered' as const,

  /**
   * Functional domains present in this project.
   * Used to tag roadmap nodes and filter context by domain.
   * Should match your actual codebase areas.
   * Examples: 'auth', 'api', 'ui', 'database', 'ai', 'payments', 'notifications'
   */
  domains: [
    'auth',
    'api',
    'ui',
    'database',
  ],

  /**
   * Runtime execution style.
   * Options: 'stateless' | 'stateful' | 'hybrid' | 'event-loop' | 'streaming'
   */
  runtimeStyle: 'stateless' as const,

  /**
   * Technology stack.
   * Used in context injection and bootstrap prompt.
   */
  preferredStack: [
    'Next.js',
    'TypeScript',
    'Prisma',
    'PostgreSQL',
    'Tailwind CSS',
  ],

  /**
   * PMOS runtime port.
   * Change if 3200 conflicts with another service.
   */
  port: 3200,

  /**
   * Context builder output path (relative to workspace root).
   * This file is read by GitHub Copilot as workspace context.
   */
  contextOutputPath: 'apps/pmos/.context/runtime-context.md',
} as const

export type PmosConfig = typeof pmosConfig
