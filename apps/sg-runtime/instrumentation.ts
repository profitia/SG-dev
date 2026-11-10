export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
    // The admitted product retention policy must resume after a server restart,
    // even if no one opens a conversation. This never calls the model.
    if(process.env.PROFITIA_ASSISTANT_ENABLED==='true'){
      const {getSg2SelectionRuntime}=await import('./lib/platform/private-runtime')
      const runtime=getSg2SelectionRuntime()
      if(runtime.provider!=='clerk'||!runtime.assistant)throw Error('Assistant Development configuration unavailable')
      await runtime.assistant()
    }
  }
  if (process.env.NEXT_RUNTIME === 'edge') await import('./sentry.edge.config')
}
