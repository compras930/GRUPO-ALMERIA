/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Fotos dos chamados de manutenção vão por server action. Chegam já
    // reduzidas pelo navegador (~150 KB cada, até 5), mas o padrão de 1 MB
    // ficava no limite. 4 MB fica abaixo do teto de 4,5 MB da Vercel.
    serverActions: { bodySizeLimit: "4mb" },
  },
};

module.exports = nextConfig;
