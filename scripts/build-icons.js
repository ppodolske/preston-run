'use strict';

const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');

const ROOT=path.resolve(__dirname,'..');
const SOURCE=path.join(ROOT,'public/icons/preston ai app icon.png');
const OUTPUTS=[
  ['favicon-32.png',32],
  ['apple-touch-icon.png',180],
  ['icon-192.png',192],
  ['icon-512.png',512],
  ['icon-maskable-512.png',512]
];

const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);

function paeth(a,b,c){
  const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);
  return pa<=pb&&pa<=pc?a:pb<=pc?b:c;
}

function decodePng(buffer){
  if(buffer.length<24||!buffer.subarray(0,8).equals(SIGNATURE))throw new Error('Icon source is not a PNG');
  let offset=8,width=0,height=0,bitDepth=0,colorType=0,interlace=0,palette=null,transparency=null;
  const idat=[];
  while(offset+12<=buffer.length){
    const length=buffer.readUInt32BE(offset);offset+=4;
    const type=buffer.subarray(offset,offset+4).toString('ascii');offset+=4;
    const data=buffer.subarray(offset,offset+length);offset+=length+4;
    if(type==='IHDR'){
      width=data.readUInt32BE(0);height=data.readUInt32BE(4);bitDepth=data[8];colorType=data[9];interlace=data[12];
    }else if(type==='PLTE')palette=Buffer.from(data);
    else if(type==='tRNS')transparency=Buffer.from(data);
    else if(type==='IDAT')idat.push(Buffer.from(data));
    else if(type==='IEND')break;
  }
  if(!width||!height||!idat.length)throw new Error('Icon source PNG is incomplete');
  if(bitDepth!==8)throw new Error(`Unsupported PNG bit depth ${bitDepth}; expected 8`);
  if(interlace!==0)throw new Error('Interlaced PNG sources are not supported');
  const channels={0:1,2:3,3:1,4:2,6:4}[colorType];
  if(!channels)throw new Error(`Unsupported PNG colour type ${colorType}`);
  if(colorType===3&&!palette)throw new Error('Indexed PNG source is missing a palette');
  const stride=width*channels;
  const inflated=zlib.inflateSync(Buffer.concat(idat));
  if(inflated.length!==(stride+1)*height)throw new Error('Unexpected PNG scanline length');
  const raw=Buffer.alloc(stride*height);
  let src=0;
  for(let y=0;y<height;y++){
    const filter=inflated[src++];
    const row=y*stride,prev=(y-1)*stride;
    for(let x=0;x<stride;x++){
      const value=inflated[src++],left=x>=channels?raw[row+x-channels]:0,up=y?raw[prev+x]:0,upLeft=y&&x>=channels?raw[prev+x-channels]:0;
      let recon;
      if(filter===0)recon=value;
      else if(filter===1)recon=value+left;
      else if(filter===2)recon=value+up;
      else if(filter===3)recon=value+Math.floor((left+up)/2);
      else if(filter===4)recon=value+paeth(left,up,upLeft);
      else throw new Error(`Unsupported PNG filter ${filter}`);
      raw[row+x]=recon&255;
    }
  }
  const rgba=Buffer.alloc(width*height*4);
  for(let i=0,p=0;i<width*height;i++,p+=4){
    const j=i*channels;
    if(colorType===6){rgba[p]=raw[j];rgba[p+1]=raw[j+1];rgba[p+2]=raw[j+2];rgba[p+3]=raw[j+3];}
    else if(colorType===2){rgba[p]=raw[j];rgba[p+1]=raw[j+1];rgba[p+2]=raw[j+2];rgba[p+3]=255;}
    else if(colorType===4){rgba[p]=raw[j];rgba[p+1]=raw[j];rgba[p+2]=raw[j];rgba[p+3]=raw[j+1];}
    else if(colorType===0){rgba[p]=raw[j];rgba[p+1]=raw[j];rgba[p+2]=raw[j];rgba[p+3]=255;}
    else {
      const index=raw[j],k=index*3;
      rgba[p]=palette[k]??0;rgba[p+1]=palette[k+1]??0;rgba[p+2]=palette[k+2]??0;rgba[p+3]=transparency&&index<transparency.length?transparency[index]:255;
    }
  }
  return{width,height,rgba};
}

function resizeSquare(image,size){
  const side=Math.min(image.width,image.height),ox=(image.width-side)/2,oy=(image.height-side)/2;
  const out=Buffer.alloc(size*size*4);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const sx=Math.max(0,Math.min(image.width-1,ox+(x+.5)*side/size-.5));
    const sy=Math.max(0,Math.min(image.height-1,oy+(y+.5)*side/size-.5));
    const x0=Math.floor(sx),y0=Math.floor(sy),x1=Math.min(image.width-1,x0+1),y1=Math.min(image.height-1,y0+1),fx=sx-x0,fy=sy-y0;
    const di=(y*size+x)*4;
    for(let c=0;c<4;c++){
      const a=image.rgba[(y0*image.width+x0)*4+c]*(1-fx)+image.rgba[(y0*image.width+x1)*4+c]*fx;
      const b=image.rgba[(y1*image.width+x0)*4+c]*(1-fx)+image.rgba[(y1*image.width+x1)*4+c]*fx;
      out[di+c]=Math.round(a*(1-fy)+b*fy);
    }
  }
  return out;
}

let crcTable=null;
function crc32(buffer){
  if(!crcTable){
    crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
  }
  let c=0xffffffff;
  for(const byte of buffer)c=crcTable[(c^byte)&255]^(c>>>8);
  return(c^0xffffffff)>>>0;
}

function chunk(type,data){
  const typeBuffer=Buffer.from(type,'ascii'),out=Buffer.alloc(12+data.length);
  out.writeUInt32BE(data.length,0);typeBuffer.copy(out,4);data.copy(out,8);
  out.writeUInt32BE(crc32(Buffer.concat([typeBuffer,data])),8+data.length);
  return out;
}

function encodePng(rgba,size){
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=6;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
  const stride=size*4,filtered=Buffer.alloc((stride+1)*size);
  for(let y=0;y<size;y++){
    const row=y*stride,prev=(y-1)*stride,dst=y*(stride+1);filtered[dst]=4;
    for(let x=0;x<stride;x++){
      const left=x>=4?rgba[row+x-4]:0,up=y?rgba[prev+x]:0,upLeft=y&&x>=4?rgba[prev+x-4]:0;
      filtered[dst+1+x]=(rgba[row+x]-paeth(left,up,upLeft)+256)&255;
    }
  }
  const compressed=zlib.deflateSync(filtered,{level:9});
  return Buffer.concat([SIGNATURE,chunk('IHDR',ihdr),chunk('IDAT',compressed),chunk('IEND',Buffer.alloc(0))]);
}

function buildIcons(){
  const source=decodePng(fs.readFileSync(SOURCE));
  const dir=path.dirname(SOURCE);
  for(const [name,size] of OUTPUTS){
    const png=encodePng(resizeSquare(source,size),size);
    fs.writeFileSync(path.join(dir,name),png);
    console.log(`${name}: ${size}x${size} (${png.length} bytes)`);
  }
}

if(require.main===module)buildIcons();
module.exports={buildIcons,decodePng,resizeSquare,encodePng};
