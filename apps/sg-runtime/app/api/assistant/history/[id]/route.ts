import {assistantHandlers} from '@/lib/assistant/conversation'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const GET=(request:Request,{params}:{params:{id:string}})=>assistantHandlers.load(request,params.id)
export const DELETE=(request:Request,{params}:{params:{id:string}})=>assistantHandlers.remove(request,params.id)
