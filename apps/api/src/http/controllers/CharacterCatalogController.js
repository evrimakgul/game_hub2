export class CharacterCatalogController {
  constructor({ characterCatalogService }) {
    this.characterCatalogService = characterCatalogService;
  }

  async getSchema(req, res) {
    const result = this.characterCatalogService.getSchema(
      req.params.campaignId,
      req.user
    );
    res.json(result);
  }

  async getPowerCatalog(req, res) {
    const result = this.characterCatalogService.getPowerCatalog(
      req.params.campaignId,
      req.user
    );
    res.json(result);
  }

  async getMeritsFlawsCatalog(req, res) {
    const result = this.characterCatalogService.getMeritsFlawsCatalog(
      req.params.campaignId,
      req.user
    );
    res.json(result);
  }
}
