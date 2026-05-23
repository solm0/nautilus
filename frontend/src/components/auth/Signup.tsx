import { useState } from "react"
import { signup } from "../../api"
import Button, { LinkButton } from "../../components/util/Button"
import SystemMessage from "./SystemMessage"

export default function Signup(){
  const [name, setName] = useState("")
  const [email,setEmail]=useState("")
  const [password,setPassword]=useState("")
  const [msg,setMsg]=useState("")

  async function submit(){
    if (name.trim() && email.trim() && password.trim()) {
      const res=await signup(email,password,name);

      if (res.detail) {
        const errMsg = Array.isArray(res.detail)
          ? res.detail[0].msg
          : res.detail || "error"
        setMsg(errMsg)
      } else setMsg("email sent.")
    } else {
      setMsg("enter your name, email, and password.")
    }
  }

  return(
    <>
      <div className="flex flex-col items-start gap-4 w-full text-lg">
        <input
          type="text"
          placeholder="name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full border-2 border-neutral-50 text-neutral-50 rounded-sm px-3 py-2 focus:outline-none opacity-30 focus:opacity-80 transition-opacity"
          autoFocus
        />

        <input
          type="text"
          placeholder="email"
          value={email}
          onChange={e=>setEmail(e.target.value)}
          className="w-full border-2 border-neutral-50 text-neutral-50 rounded-sm px-3 py-2 focus:outline-none opacity-30 focus:opacity-80 transition-opacity"
        />

        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={e=>setPassword(e.target.value)}
          className="w-full border-2 border-neutral-50 text-neutral-50 rounded-sm px-3 py-2 focus:outline-none opacity-30 focus:opacity-50 transition-opacity"
        />

        <div className="flex flex-col gap-2 w-full">
          <SystemMessage msg={msg} />
          <Button text="Sign up" onClick={submit} fit />
        </div>
      </div>


      <div className="flex flex-col gap-2 text-neutral-50">
        <LinkButton text="Already have an account?" link="/login" />
      </div>
    </>
  )
}