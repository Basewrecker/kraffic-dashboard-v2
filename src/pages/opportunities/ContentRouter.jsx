// Opportunities → Content: /opportunities/content is the list, /opportunities/content/<id> one prompt's workspace
import { usePath } from '../../router'
import ContentList from './ContentList'
import Workspace from './Workspace'
import { LIST_PATH } from './parts'
import { SAMPLE_ROWS } from '../../data/contentRecommend'

export default function ContentRouter() {
  const path = usePath()
  const raw = path.startsWith(`${LIST_PATH}/`) ? path.slice(LIST_PATH.length + 1) : null
  // a number (the list's prompts), or a sample account's id (rm-1: the live reverse-mortgage sample)
  const id = raw == null || raw === '' ? null : /^\d+$/.test(raw) ? Number(raw) : SAMPLE_ROWS.some((r) => r.id === raw) ? raw : null
  return id != null ? <Workspace id={id} /> : <ContentList />
}
