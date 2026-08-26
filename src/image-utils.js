export async function compressImage(file,{maxSide=1600,quality=.72}={}){
  if(!file?.type?.startsWith('image/'))throw new Error('Arquivo de imagem inválido');
  const bitmap=await createImageBitmap(file),scale=Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height)),width=Math.max(1,Math.round(bitmap.width*scale)),height=Math.max(1,Math.round(bitmap.height*scale)),canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d').drawImage(bitmap,0,0,width,height);bitmap.close?.();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
  if(!blob)throw new Error('Não foi possível otimizar a foto');
  return new Promise((resolve,reject)=>{const reader=new FileReader;reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(blob)})
}

