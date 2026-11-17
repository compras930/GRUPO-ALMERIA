// Reduz a foto no NAVEGADOR antes de enviar: foto de celular tem 3–8 MB, e
// isso não passa no limite de envio do servidor nem cabe bem no banco. Lado
// maior em 1280 px e JPEG 0,72 deixa cada foto com ~150 KB e ainda legível
// para ver uma rachadura ou um disjuntor.
export async function reduzirFoto(arquivo: File, ladoMax = 1280, qualidade = 0.72): Promise<File> {
  const url = URL.createObjectURL(arquivo);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Não consegui ler esta foto."));
      i.src = url;
    });
    const escala = Math.min(1, ladoMax / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob>((res, rej) =>
      canvas.toBlob((b) => (b ? res(b) : rej(new Error("Falha ao reduzir a foto."))), "image/jpeg", qualidade)
    );
    return new File([blob], arquivo.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
