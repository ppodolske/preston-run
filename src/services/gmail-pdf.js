function flattenParts(part,out=[]){
  if(!part)return out;
  if(Array.isArray(part.parts))for(const child of part.parts)flattenParts(child,out);
  else out.push(part);
  return out;
}

function findPdfAttachments(message){
  return flattenParts(message.payload).filter(part=>part.mimeType==='application/pdf'&&part.body&&part.body.attachmentId).map(part=>({
    gmailAttachmentId:part.body.attachmentId,
    filename:part.filename||'attachment.pdf',
    mimeType:part.mimeType
  }));
}

function decodeBase64Url(data){
  const text=String(data||'').replace(/-/g,'+').replace(/_/g,'/');
  if(!text)return Buffer.alloc(0);
  return Buffer.from(text.padEnd(Math.ceil(text.length/4)*4,'='),'base64');
}

async function extractNativePdfText(buffer,{pdfParse}={}){
  if(!buffer||buffer.length===0)return {status:'skipped',text:'',reason:'empty_pdf'};
  if(!pdfParse)return {status:'skipped',text:'',reason:'pdf_parser_not_configured'};
  try{
    const result=await pdfParse(buffer);
    const text=String(result.text||'').trim();
    if(!text)return {status:'skipped',text:'',reason:'no_native_text'};
    return {status:'processed',text,reason:null};
  }catch(error){
    const msg=String(error.message||error);
    if(/password/i.test(msg))return {status:'skipped',text:'',reason:'password_protected_pdf'};
    return {status:'retry',text:'',reason:'pdf_parse_error'};
  }
}

module.exports={findPdfAttachments,extractNativePdfText,flattenParts,decodeBase64Url};
