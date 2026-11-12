/* Mural do 1 Real — configuração
   Troque PIX_KEY e KIWIFY_URL quando o pagamento estiver pronto.
   Não commitar chave Pix real em repositório público, se for o caso:
   edite este arquivo só no deploy, ou troque depois do primeiro publish. */
window.MURAL_CONFIG = {
  PIX_KEY: "161.960.879-08",
  KIWIFY_URL: "https://pay.kiwify.com.br/COLE_SEU_LINK_AQUI",
  FORMSUBMIT_ENDPOINT: "https://formsubmit.co/ajax/nexora.br.ai@gmail.com",
  CONTACT_EMAIL: "nexora.br.ai@gmail.com",
  GRID_SIZE: 100,
  BLOCK_PRICE_BRL: 1,
  /* Centro do mural: reservado para o leilão do Pixel de Ouro / Trono */
  THRONE: { x: 45, y: 45, w: 10, h: 10 },
  MAX_NAME: 32,
  MAX_PHRASE: 80,
  SOLD_DATA_URL: "data/sold.json",
};
