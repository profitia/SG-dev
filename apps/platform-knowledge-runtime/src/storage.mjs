import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand,HeadObjectCommand} from '@aws-sdk/client-s3';
import {Fault,digest} from './store.mjs';
export function createStorage(env){
 const endpoint=new URL(env.PK_S3_ENDPOINT??'');
 if(endpoint.href!=='https://br-billowing-grass-b9ko5s4f.storage.c-7.eu-central-1.aws.neon.tech/'
  ||env.PK_S3_BUCKET!=='platform-knowledge-uploads'||env.AWS_REGION!=='eu-central-1')throw Error('STORAGE_BINDING_REJECTED');
 const client=new S3Client({endpoint:endpoint.href,region:'eu-central-1',forcePathStyle:true,maxAttempts:1,
  credentials:{accessKeyId:env.AWS_ACCESS_KEY_ID,secretAccessKey:env.AWS_SECRET_ACCESS_KEY}});
 const key=value=>{if(!/^development\/[a-f0-9-]{36}\/[a-f0-9]{64}$/.test(value))throw Error('STORAGE_KEY_REJECTED');return value;};
 const bucket=env.PK_S3_BUCKET;
 return {
  async put(objectKey,body,sha256){if(digest(body)!==sha256)throw new Fault(422,'SOURCE_DIGEST_MISMATCH');
   await client.send(new PutObjectCommand({Bucket:bucket,Key:key(objectKey),Body:body,ContentType:'application/octet-stream',Metadata:{sha256}}),{abortSignal:AbortSignal.timeout(60000)});},
  async get(objectKey,sha256){
   const r=await client.send(new GetObjectCommand({Bucket:bucket,Key:key(objectKey)}),{abortSignal:AbortSignal.timeout(60000)});
   if(r.ContentLength>52428800)throw new Fault(413,'FILE_LIMIT');
   let size=0,parts=[];for await(const b of r.Body){size+=b.length;if(size>52428800){r.Body.destroy();throw new Fault(413,'FILE_LIMIT');}parts.push(b);}
   const bytes=Buffer.concat(parts);if(digest(bytes)!==sha256)throw new Fault(422,'SOURCE_DIGEST_MISMATCH');return bytes;
  },
  async remove(objectKey){await client.send(new DeleteObjectCommand({Bucket:bucket,Key:key(objectKey)}),{abortSignal:AbortSignal.timeout(60000)});
   try{await client.send(new HeadObjectCommand({Bucket:bucket,Key:objectKey}),{abortSignal:AbortSignal.timeout(15000)});throw new Fault(503,'RAW_DELETE_NOT_CONFIRMED');}
   catch(e){if(e?.$metadata?.httpStatusCode!==404)throw e;}},
  close:()=>client.destroy()
 };
}
