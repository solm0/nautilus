import { useEffect, useState } from "react"
import { fetchMutuals, fetchReceived, fetchSent, requestMutual, acceptMutual } from "../../api"
import { ResponsiveModal } from "../util/ResponsiveModal"
import Button, { IconButton } from "../util/Button"
import { Plus } from "lucide-react"
import SystemMessage from "../auth/SystemMessage"
import type { User } from "../../types"
import { UserIcon } from "./Setting"
import { useI18n } from "../../i18n"

export type TimelineItem = {
  id: number
  content: string
  created_at: string

  user?: User;

  page_id: number
  page_name: string
  source: string

  type?: "link" | "memo" | "emoji"
  comment_count: number
}

export default function Mutuals() {
  const { t } = useI18n();
  const [mutuals, setMutuals] = useState<User[]>([])
  const [received, setReceived] = useState<{ id: number; user: User }[]>([])
  const [sent, setSent] = useState<User[]>([])

  const [openList, setOpenList] = useState(false)
  const [openSend, setOpenSend] = useState(false)
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const m = await fetchMutuals()
    const r = await fetchReceived()
    const s = await fetchSent()

    setMutuals(m.items)
    setReceived(r)
    setSent(s.items)
  }

  async function handleRequest() {
    try {
      setError(null)
      await requestMutual(email)
      setEmail("")
      setOpenSend(false)
      load()
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message)
      }
    }
  }

  async function handleAccept(id: number) {
    await acceptMutual(id)
    load()
  }

  return (
    <div className="flex flex-col gap-7">
      {/* 1. my mutuals */}
      <div className="flex items-center gap-3">
        <Button text={t("My mutuals")} onClick={() => setOpenList(true)} />
        <IconButton icon={<Plus size={15} />} onClick={() => setOpenSend(true)} />
      </div>

      {/* modal */}
      <ResponsiveModal open={openSend} onClose={() => setOpenSend(false)}>
        <div className="flex flex-col gap-7">
          <h2 className="text-lg font-semibold">{t("Send request")}</h2>

          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("email")}
            className="border-2 border-neutral-300 rounded-sm px-3 py-2 focus:outline-none opacity-50 focus:opacity-100"
          />

          <div className="flex flex-col gap-2">
            {error && <SystemMessage msg={error} />}
            <Button text={t("Request")} onClick={handleRequest} fit black />
          </div>
        </div>
      </ResponsiveModal>

      <ResponsiveModal open={openList} onClose={() => setOpenList(false)}>
        <div className="flex flex-col gap-7">
          <h2>{t("My mutuals")}</h2>

          {mutuals.length === 0 && (
            <p className="text-sm opacity-50">{t("No mutuals yet")}</p>
          )}

          {mutuals.map(u => (
            <div key={u.id} className="flex gap-3 border-b border-neutral-200 p-2 items-start">
              <UserIcon user={u} />
              <div key={u.id} className="">
                <p>{u.name || t("Unnamed")}</p>
                <p className="text-sm opacity-50">{u.email}</p>
              </div>
            </div>
          ))}
        </div>
      </ResponsiveModal>

      {/* 3. received */}
      {received.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3>{t("Requests")}</h3>
          {received.map(r => (
            <div key={r.id} className="flex justify-between items-center">
              <div>
                <p>{r.user.name || t("Unnamed")}</p>
                <p className="text-sm opacity-50">{r.user.email}</p>
              </div>
              <Button text={t("Accept")} onClick={() => handleAccept(r.id)} />
            </div>
          ))}
        </div>
      )}

      {/* 4. sent */}
      {sent.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3>{t("Sent")}</h3>
          {sent.map(u => (
            <div key={u.id}>
              <p>{u.name || t("Unnamed")}</p>
              <p className="text-sm opacity-50">{u.email}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
