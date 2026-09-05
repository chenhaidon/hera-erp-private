// 浦江家纺智造管理平台 - 统一数据持久化 API
// 所有业务实体通过 entity_store（id + entity_type + data jsonb）实现增删改查
export {
  fetchAllEntities,
  fetchEntities,
  insertEntity,
  updateEntity,
  deleteEntity,
  seedEntities,
} from '@/store/dbActions';
