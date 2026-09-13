const assert=require('node:assert/strict');
const {findPdfAttachments,extractNativePdfText}=require('../src/services/gmail-pdf');

const message={payload:{parts:[
  {filename:'itinerary.pdf',mimeType:'application/pdf',body:{attachmentId:'att1'}},
  {filename:'photo.jpg',mimeType:'image/jpeg',body:{attachmentId:'att2'}}
]}};
const pdfs=findPdfAttachments(message);
assert.equal(pdfs.length,1);
assert.equal(pdfs[0].gmailAttachmentId,'att1');
assert.equal(pdfs[0].filename,'itinerary.pdf');

(async()=>{
  const empty=await extractNativePdfText(Buffer.from(''),{});
  assert.equal(empty.status,'skipped');
  assert.equal(empty.reason,'empty_pdf');
  const parsed=await extractNativePdfText(Buffer.from('pdf'),{pdfParse:async()=>({text:' Booking ABC123 '})});
  assert.equal(parsed.status,'processed');
  assert.equal(parsed.text,'Booking ABC123');
  console.log('gmail pdf tests passed');
})();
