import { withoutSqlLogs } from "@terramatch-microservices/common/util/repl/without-sql-logs";
import { PaginatedQueryBuilder } from "@terramatch-microservices/common/util/paginated-query.builder";
import { SiteReport, UpdateRequest } from "@terramatch-microservices/database/entities";
import { Op } from "sequelize";
import { Subquery } from "@terramatch-microservices/database/util/subquery.builder";
import ProgressBar from "progress";
import { batchFindAll } from "@terramatch-microservices/common/util/batch-find-all";
import { EmbeddedTreeSpeciesDto } from "@terramatch-microservices/common/dto/tree-species.dto";
import { Dictionary } from "lodash";

const OLD_NON_TREE_Q = "a8300383-4b3b-46c4-85f6-3c31b98e751a";
const NEW_NON_TREE_Q = "df476f50-ce43-412b-b1be-2dfc61ef2967";
const NON_TREE_PARENT = "b048bea8-3c32-4707-92a0-b9c9c41f3294";
const OLD_TREE_PLANTED_Q = "ed1046ad-33e3-4c4d-85c3-7c9cec9ea679";
const NEW_TREE_PLANTED_Q = "dc871e8a-c95b-4734-a901-1c7796e50606";
const TREE_PLANTED_PARENT = "0a6e0787-8185-45c3-a659-4b56e37c7ff7";

const TREE_NAME_MAPPING: Dictionary<{ name: string; taxonId: string }> = {
  "Sorghum bicolor": { name: "Sorghum bicolor", taxonId: "wfo-0000900184" },
  "Arachis hypogaea": { name: "Arachis hypogaea", taxonId: "wfo-0000174378" },
  "Azadirachta indica": { name: "Azadirachta indica", taxonId: "wfo-0000557668" },
  "Acacia Tortilis": { name: "Vachellia tortilis", taxonId: "wfo-0001285358" },
  "Mangifera indica": { name: "Mangifera indica", taxonId: "wfo-0000371248" },
  "Persea Americana": { name: "Persea americana", taxonId: "wfo-0000465160" },
  "Citrus Sinensis": { name: "Citrus * aurantium", taxonId: "wfo-0000607909" },
  "Moringa Oloifera": { name: "Moringa oleifera", taxonId: "wfo-0001085051" },
  "Azandiracta indica": { name: "Azadirachta indica", taxonId: "wfo-0000557668" },
  "Leucaena leucocephala": { name: "Leucaena leucocephala", taxonId: "wfo-0000164084" },
  "Passiflora edulis": { name: "Passiflora edulis", taxonId: "wfo-0000479905" },
  "Musa acuminata (bananas)": { name: "Musa acuminata", taxonId: "wfo-0000473834" },
  "Carica Papaya (pawpaw)": { name: "Carica papaya", taxonId: "wfo-0000588009" },
  Croton: { name: "Croton", taxonId: "wfo-4000009788" },
  Moringa: { name: "Moringa oleifera", taxonId: "wfo-0001085051" },
  Acacia: { name: "Acacia", taxonId: "wfo-4000000074" },
  Mangifera: { name: "Mangifera indica", taxonId: "wfo-0000371248" },
  Citrus: { name: "Citrus", taxonId: "wfo-4000008411" },
  Persea: { name: "Persea americana", taxonId: "wfo-0000465160" },
  Senna: { name: "Senna", taxonId: "wfo-4000035076" },
  Olea: { name: "Olea", taxonId: "wfo-4000026703" },
  Grevillea: { name: "Grevillea robusta", taxonId: "wfo-0000709544" },
  Azadirachta: { name: "Azadirachta indica", taxonId: "wfo-0000557668" },
  Lucern: { name: "Medicago sativa", taxonId: "wfo-0000213468" },
  "Acacia tortilis": { name: "Vachellia tortilis", taxonId: "wfo-0001285358" },
  "Croton megalocarpus": { name: "Croton megalocarpus", taxonId: "wfo-0000931666" },
  "Acacia xanthophloea": { name: "Vachellia xanthophloea", taxonId: "wfo-1200001694" },
  "Croton Megalocarpus": { name: "Croton megalocarpus", taxonId: "wfo-0000931666" },
  "Prunus africana": { name: "Prunus africana", taxonId: "wfo-0000995790" },
  Avocado: { name: "Persea americana", taxonId: "wfo-0000465160" },
  "Maesopsis eminii": { name: "Maesopsis eminii", taxonId: "wfo-0000452431" },
  Mangoes: { name: "Mangifera indica", taxonId: "wfo-0000371248" },
  "Khaya anthotheca": { name: "Khaya anthotheca", taxonId: "wfo-0000357006" },
  "Jack Fruit": { name: "Artocarpus heterophyllus", taxonId: "wfo-0000550491" },
  "Milicia excelsa": { name: "Milicia excelsa", taxonId: "wfo-0000447908" },
  "Maesopsis Eminii": { name: "Maesopsis eminii", taxonId: "wfo-0000452431" },
  "Grevillea Robusta": { name: "Grevillea robusta", taxonId: "wfo-0000709544" },
  "Terminalia Superba": { name: "Terminalia superba", taxonId: "wfo-0000408519" },
  "TERMINALIA SUPERBA": { name: "Terminalia superba", taxonId: "wfo-0000408519" },
  "KHAYA SENEGALENSIS": { name: "Khaya senegalensis", taxonId: "wfo-0000356989" },
  "MANSONIA ALTISSIMA": { name: "Mansonia altissima", taxonId: "wfo-0000450928" },
  "CEDRELLA ORDORATA": { name: "Cedrela odorata", taxonId: "wfo-0000592446" },
  "SENNA SIAMEA": { name: "Senna siamea", taxonId: "wfo-0000164745" },
  "Acacia (Acacia spp)": { name: "Acacia", taxonId: "wfo-4000000074" },
  "Moringa (Moringa oleifera)": { name: "Moringa oleifera", taxonId: "wfo-0001085051" },
  "Gliricidia sepium": { name: "Gliricidia sepium", taxonId: "wfo-0000178022" },
  "Markhamia lutea": { name: "Markhamia lutea", taxonId: "wfo-0000779039" },
  "Pterygota mildbraedii": { name: "Pterygota mildbraedii", taxonId: "wfo-0001141220" },
  "Calliandra sp": { name: "Calliandra", taxonId: "wfo-4000006042" },
  Molucata: { name: "Acacia mangium", taxonId: "wfo-0000202567" },
  Mango: { name: "Mangifera indica", taxonId: "wfo-0000371248" },
  "Warbugia ugandesis": { name: "Warburgia ugandensis", taxonId: "wfo-0000427581" },
  "Leuceana leucocephala": { name: "Leucaena leucocephala", taxonId: "wfo-0000164084" },
  "Faidherbia albida": { name: "Faidherbia albida", taxonId: "wfo-0000186081" },
  "Pinus kesiya": { name: "Pinus kesiya", taxonId: "wfo-0000481052" },
  "Calliandra sp.": { name: "Calliandra", taxonId: "wfo-4000006042" },
  Jackfruit: { name: "Artocarpus heterophyllus", taxonId: "wfo-0000550491" },
  "Warbugia ugandensis": { name: "Warburgia ugandensis", taxonId: "wfo-0000427581" },
  "Khaya senegalensis": { name: "Khaya senegalensis", taxonId: "wfo-0000356989" },
  "Parkia biglobosa": { name: "Parkia biglobosa", taxonId: "wfo-0000179230" },
  "Tamarindus indica": { name: "Tamarindus indica", taxonId: "wfo-0000170926" },
  "Vitex doniana": { name: "Vitex doniana", taxonId: "wfo-0000333061" },
  "Vitellaria paradoxa": { name: "Vitellaria paradoxa", taxonId: "wfo-0000332885" },
  "Afzelia africana": { name: "Afzelia africana", taxonId: "wfo-0000213207" },
  "Triplochiton Scleroxylon": { name: "Triplochiton scleroxylon", taxonId: "wfo-0000456002" },
  "Terminalia of superba": { name: "Terminalia superba", taxonId: "wfo-0000408519" },
  "Cedrela odorata": { name: "Cedrela odorata", taxonId: "wfo-0000592446" },
  "Acacia xanthophloes": { name: "Vachellia xanthophloea", taxonId: "wfo-1200001694" },
  "Juniperus procera": { name: "Juniperus procera", taxonId: "wfo-0000355729" },
  "Moringa oleifera": { name: "Moringa oleifera", taxonId: "wfo-0001085051" },
  "Leauceana leucocephala": { name: "Leucaena leucocephala", taxonId: "wfo-0000164084" },
  "Avicennia marina": { name: "Avicennia marina", taxonId: "wfo-0000303022" },
  "Ceriops tagal": { name: "Ceriops tagal", taxonId: "wfo-0000597945" },
  "Rhizophora mucronata": { name: "Rhizophora mucronata", taxonId: "wfo-0001131556" },
  "Bruguiera gymnorhiza": { name: "Bruguiera gymnorhiza", taxonId: "wfo-0000572747" },
  "Framiré (Terminalia ivorensis)": { name: "Terminalia ivorensis", taxonId: "wfo-0000408726" },
  "Fraké (Terminalia superba)": { name: "Terminalia superba", taxonId: "wfo-0000408519" },
  "Bété (Mansonia altissima)": { name: "Mansonia altissima", taxonId: "wfo-0000450928" },
  "Petit cola (Garcinia kola)": { name: "Garcinia kola", taxonId: "wfo-0000694394" },
  "Obero (Picralima nitida)": { name: "Picralima nitida", taxonId: "wfo-0000273290" },
  "Akpi (Ricinodendron heudelotii)": { name: "Ricinodendron heudelotii", taxonId: "wfo-0000297055" },
  "Maize (in Acres)": { name: "Zea mays", taxonId: "wfo-0000907754" },
  "Penicetum glaucum": { name: "Cenchrus americanus", taxonId: "wfo-0000917339" },
  "Zingliber officinale": { name: "Zingiber officinale", taxonId: "wfo-0000617397" },
  "Coffea canephora": { name: "Coffea canephora", taxonId: "wfo-0000910571" },
  "Cinnamomum verum": { name: "Cinnamomum verum", taxonId: "wfo-0000605512" },
  "Theobroma cacao": { name: "Theobroma cacao", taxonId: "wfo-0000458440" },
  "Schinus terebinthifolius": { name: "Schinus terebinthifolia", taxonId: "wfo-0000435152" },
  "Artocarpus heterophyllus": { name: "Artocarpus heterophyllus", taxonId: "wfo-0000550491" },
  "Citrus sinensis": { name: "Citrus * aurantium", taxonId: "wfo-0000607909" },
  "Eriobotrya japonica": { name: "Eriobotrya japonica", taxonId: "wfo-0000986002" },
  "Annona spp": { name: "Annona", taxonId: "wfo-4000002240" },
  "Albizia lebbeck": { name: "Albizia lebbeck", taxonId: "wfo-0000184271" },
  "Cryptocarya spp": { name: "Cryptocarya", taxonId: "wfo-4000009873" },
  "Dilobeia thouarsii": { name: "Dilobeia thouarsii", taxonId: "wfo-0000647697" },
  "Bridelia toulasneana": { name: "Bridelia tulasneana", taxonId: "wfo-0000428863" },
  "Abrahamia thouvenotii": { name: "Abrahamia thouvenotii", taxonId: "wfo-0001248689" },
  "Canarium madagascariensis": { name: "Canarium madagascariense", taxonId: "wfo-0000583603" },
  "Syzygium sp.": { name: "Syzygium", taxonId: "wfo-4000037381" },
  "Mammea bongo": { name: "Mammea bongo", taxonId: "wfo-0000376873" },
  Tsimitetra: { name: "Ilex mitis", taxonId: "wfo-0000729632" },
  Tavia: { name: "Rhopalocarpus coriaceus", taxonId: "wfo-0000627601" },
  "Symphonia gymnoclada": { name: "Symphonia gymnoclada", taxonId: "wfo-0001284073" },
  "Uapaca louvelii": { name: "Uapaca louvelii", taxonId: "wfo-0000329059" },
  Hazombato: { name: "Kalanchoe orgyalis", taxonId: "wfo-0001299810" },
  "Senna siamea": { name: "Senna siamea", taxonId: "wfo-0000164745" },
  "Albizzia lebbeck": { name: "Albizia lebbeck", taxonId: "wfo-0000184271" },
  "Anogeissus leiocarpus": { name: "Terminalia leiocarpa", taxonId: "wfo-0000408839" },
  "Artocarpus heterophyllus (Jack Fruit)": { name: "Artocarpus heterophyllus", taxonId: "wfo-0000550491" },
  Mahogany: { name: "Khaya", taxonId: "wfo-4000019975" },
  "Mangifera Indica": { name: "Mangifera indica", taxonId: "wfo-0000371248" },
  "Acacia ataxacantha": { name: "Senegalia ataxacantha", taxonId: "wfo-0001336544" },
  "Acacia robusta": { name: "Vachellia robusta", taxonId: "wfo-0001336881" },
  "Acacia sieberiana": { name: "Vachellia sieberiana", taxonId: "wfo-0001336883" },
  "Annona senagelensis": { name: "Annona senegalensis", taxonId: "wfo-0000537928" },
  "Caesalpinia decapetala": { name: "Biancaea decapetala", taxonId: "wfo-0001056568" },
  "Carissa edulis": { name: "Carissa spinarum", taxonId: "wfo-0000803913" },
  "Citris sinensis": { name: "Citrus * aurantium", taxonId: "wfo-0000607909" },
  "Combretum kraussi": { name: "Combretum kraussii", taxonId: "wfo-0000616428" },
  "Dalnergia armata": { name: "Dalbergia armata", taxonId: "wfo-0000197953" },
  "Indigofera so": { name: "Indigofera", taxonId: "wfo-4000019058" },
  "Zizphus mucrunata": { name: "Ziziphus mucronata", taxonId: "wfo-0000430319" },
  "Diosporys villosa": { name: "Diospyros villosa", taxonId: "wfo-0000649950" },
  "Englerophytum magaliesmontanum": { name: "Englerophytum magalismontanum", taxonId: "wfo-0000949109" },
  "Euclean divinorum": { name: "Euclea divinorum", taxonId: "wfo-0000681081" }
};

export const fixSiteReportTrees = withoutSqlLogs(async () => {
  const builder = new PaginatedQueryBuilder(UpdateRequest, 100).where({
    updateRequestableType: SiteReport.LARAVEL_TYPE,
    updateRequestableId: { [Op.in]: Subquery.select(SiteReport, "id").eq("frameworkKey", "terrafund").literal },
    status: { [Op.ne]: "approved" }
  });
  const total = await builder.paginationTotal();
  const bar = new ProgressBar(`Processing ${total} site report update requests [:bar] :percent :etas`, {
    width: 40,
    total
  });
  for await (const page of batchFindAll(builder)) {
    for (const updateRequest of page) {
      await copyContent(updateRequest, OLD_TREE_PLANTED_Q, NEW_TREE_PLANTED_Q, TREE_PLANTED_PARENT);
      await copyContent(updateRequest, OLD_NON_TREE_Q, NEW_NON_TREE_Q, NON_TREE_PARENT);
      bar.tick();
    }
  }

  if (missingMappings.length === 0) {
    console.log("No old tree species were missing a mapping");
  } else {
    console.log(`Found ${missingMappings.length} old tree species that were missing a mapping:`);
    console.log(JSON.stringify(missingMappings, null, 2));
  }
});

const missingMappings: { uuid?: string; name: string | null }[] = [];

const copyContent = async (updateRequest: UpdateRequest, oldQ: string, newQ: string, parentQ: string) => {
  const oldContent = updateRequest.content?.[oldQ];
  if (!Array.isArray(oldContent) || oldContent.length === 0) return;

  const report = await SiteReport.findByPk(updateRequest.updateRequestableId);

  const oldTrees = oldContent as EmbeddedTreeSpeciesDto[];
  const newTrees = [...((updateRequest.content?.[newQ] ?? []) as EmbeddedTreeSpeciesDto[])];
  const updateTrees: EmbeddedTreeSpeciesDto[] = [];
  for (const oldTree of oldTrees) {
    const mapping = oldTree.name == null ? undefined : TREE_NAME_MAPPING[oldTree.name];
    const newTree = newTrees.find(({ name }) => name === mapping?.name || name === oldTree.name);
    if (newTree == null) {
      if (mapping == null) {
        missingMappings.push({ uuid: report?.uuid, name: oldTree.name });
      } else {
        const { name, taxonId } = mapping;
        const { uuid, collection, amount } = oldTree;
        updateTrees.push({ uuid, name, amount, taxonId, collection });
      }
    } else if (newTree.amount === 0 || newTree.amount == null) {
      const { name, taxonId, uuid, collection } = newTree;
      updateTrees.push({ uuid, name, amount: oldTree.amount, taxonId, collection });
    }
  }

  await updateRequest.update({
    content: {
      ...updateRequest.content,
      [newQ]: updateTrees,
      [parentQ]: true
    }
  });

  if (report != null) {
    await report.update({
      answers: {
        ...(report.answers ?? {}),
        [parentQ]: true
      }
    });
  }
};
