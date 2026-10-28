import React,{forwardRef} from 'react'
// Public primitive adapter. Actual Canon IDs are supplied by the pinned controls.
type CanonProps={canonId:string;usage:string}
export const CanonElement=forwardRef<any,CanonProps & {as:keyof React.JSX.IntrinsicElements;[key:string]:any}>(function CanonElement({as,canonId,usage,...props},ref){
  return React.createElement(as,{...props,ref,'data-library-component':canonId,'data-canon-usage':usage,
    'data-canon-source':'463321469305384960:465857540723474432'})
})
export const CanonButton=forwardRef<HTMLButtonElement,React.ButtonHTMLAttributes<HTMLButtonElement>&CanonProps>(function CanonButton({canonId,usage,...props},ref){
  return <button {...props} ref={ref} data-library-component={canonId} data-canon-usage={usage}
    data-canon-source="463321469305384960:465857540723474432"/>
})
