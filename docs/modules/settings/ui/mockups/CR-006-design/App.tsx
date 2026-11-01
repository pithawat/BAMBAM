import { useEffect, useRef, useState, type FormEvent } from "react"
import {
  ArrowDownToLine,
  ArrowRight,
  Bell,
  BookOpen,
  Box,
  Building2,
  Car,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  DoorOpen,
  Ellipsis,
  FileText,
  Home,
  Info,
  Layers,
  MapPin,
  Monitor,
  Pencil,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Tag,
  Trash2,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react"

const groups = [
  {
    name: "สถานที่และอุปกรณ์",
    icon: Building2,
    desc: "จัดการพื้นที่และทรัพย์สิน",
    menus: ["อาคารและอุปกรณ์", "หน่วยงานและอาคาร", "ประเภทอุปกรณ์"],
  },
  {
    name: "การให้บริการ",
    icon: Wrench,
    desc: "กำหนดบริการในองค์กร",
    menus: ["การแจ้งซ่อม", "การจองรถ", "การจองห้องประชุม"],
  },
  {
    name: "ผู้ใช้งานและสิทธิ์",
    icon: Users,
    desc: "ดูแลสมาชิกและการเข้าถึง",
    menus: ["ผู้ใช้งาน", "บทบาทและสิทธิ์"],
  },
  {
    name: "การตั้งค่าทั่วไป",
    icon: SlidersHorizontal,
    desc: "ปรับแต่งระบบของคุณ",
    menus: ["ข้อมูลองค์กร", "การแจ้งเตือน"],
  },
]
const roomNames = [
  "Data and Digitization",
  "ห้องประชุม 101",
  "Marketing",
  "ฝ่ายทรัพยากรบุคคล",
  "ห้องผู้บริหาร",
  "พื้นที่ส่วนกลาง",
]
type Equipment = {
  id: string
  name: string
  detail: string
  type: string
  status: boolean
  room: string
  floor: number
  building: string
}
const initialEquipment: Equipment[] = [
  {
    id: "AC-001",
    name: "เครื่องปรับอากาศ Daikin",
    detail: "Daikin Inverter · 24,000 BTU",
    type: "เครื่องปรับอากาศ",
    status: true,
    room: roomNames[0],
    floor: 1,
    building: "อาคาร 1.1",
  },
  {
    id: "AC-002",
    name: "เครื่องปรับอากาศ Mitsubishi",
    detail: "Mitsubishi Electric · 18,000 BTU",
    type: "เครื่องปรับอากาศ",
    status: true,
    room: roomNames[0],
    floor: 1,
    building: "อาคาร 1.1",
  },
  {
    id: "IT-001",
    name: "คอมพิวเตอร์ตั้งโต๊ะ Dell",
    detail: "Dell OptiPlex 7010",
    type: "อุปกรณ์ไอที",
    status: true,
    room: roomNames[0],
    floor: 1,
    building: "อาคาร 1.1",
  },
  {
    id: "IT-002",
    name: "จอแสดงผล Samsung",
    detail: "Samsung Smart Monitor · 27 นิ้ว",
    type: "อุปกรณ์ไอที",
    status: false,
    room: roomNames[0],
    floor: 1,
    building: "อาคาร 1.1",
  },
  {
    id: "IT-003",
    name: "โปรเจคเตอร์ Epson",
    detail: "Epson EB-X51",
    type: "อุปกรณ์ไอที",
    status: true,
    room: roomNames[1],
    floor: 1,
    building: "อาคาร 1.1",
  },
  {
    id: "AC-003",
    name: "เครื่องปรับอากาศ Daikin",
    detail: "Daikin Inverter · 24,000 BTU",
    type: "เครื่องปรับอากาศ",
    status: true,
    room: roomNames[2],
    floor: 1,
    building: "อาคาร 1.1",
  },
]
const typeIcon = (type: string) =>
  type === "เครื่องปรับอากาศ" ? Snowflake : type === "อุปกรณ์ไอที" ? Monitor : Box
function IconBadge({
  icon: Icon,
  className = "",
}: {
  icon: LucideIcon
  className?: string
}) {
  return (
    <span className={`icon-badge ${className}`}>
      <Icon size={19} strokeWidth={1.7} />
    </span>
  )
}

export default function App() {
  const [group, setGroup] = useState(0)
  const [page, setPage] = useState(groups[0].menus[0])
  const [dropdown, setDropdown] = useState<string | null>(null)
  const [hoverGroup, setHoverGroup] = useState(0)
  const [building, setBuilding] = useState("อาคาร 1.1")
  const [floor, setFloor] = useState(1)
  const [room, setRoom] = useState(roomNames[0])
  const [equipment, setEquipment] = useState(initialEquipment)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("ทุกประเภท")
  const [showInactive, setShowInactive] = useState(true)
  const [modal, setModal] = useState<string | null>(null)
  const [editing, setEditing] = useState<Equipment | null>(null)
  const [toast, setToast] = useState("")
  const [selected, setSelected] = useState<string[]>([])
  const [notified, setNotified] = useState(false)
  const [organization, setOrganization] = useState(
    "บริษัท บริหารสินทรัพย์ กรุงเทพพาณิชย์ จำกัด (มหาชน)",
  )
  const [notificationOn, setNotificationOn] = useState(true)
  const [extraRows, setExtraRows] = useState<Record<string, string[]>>({})
  const dropdownRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!modal) return
    const previous = document.activeElement as HTMLElement | null
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]')
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input, select, a[href]",
        ) || [],
      )
    const initialFocus =
      dialog?.querySelector<HTMLElement>("[autofocus], input") || focusable()[0]
    initialFocus?.focus()
    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return
      const elements = focusable()
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    document.addEventListener("keydown", trapFocus)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", trapFocus)
      previous?.focus()
    }
  }, [modal])
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setDropdown(null)
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDropdown(null)
        setModal(null)
      }
    }
    document.addEventListener("mousedown", close)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("mousedown", close)
      document.removeEventListener("keydown", escape)
    }
  }, [])
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3500)
      return () => clearTimeout(timer)
    }
  }, [toast])
  const navigate = (g: number, p = groups[g].menus[0]) => {
    setGroup(g)
    setPage(p)
    setDropdown(null)
    setSearch("")
  }
  const roomEquipment = equipment.filter(
    (e) => e.room === room && e.floor === floor && e.building === building,
  )
  const visible = roomEquipment.filter(
    (e) =>
      (!search ||
        `${e.name} ${e.id}`.toLowerCase().includes(search.toLowerCase())) &&
      (filter === "ทุกประเภท" || e.type === filter) &&
      (showInactive || e.status),
  )
  const countRoom = (name: string) =>
    equipment.filter(
      (e) => e.room === name && e.floor === floor && e.building === building,
    ).length
  const exportData = () => {
    const csv =
      "\ufeffรหัสอุปกรณ์,ชื่ออุปกรณ์,ประเภท,สถานะ\n" +
      roomEquipment
        .map(
          (e) =>
            `${e.id},${e.name},${e.type},${e.status ? "พร้อมใช้งาน" : "ไม่ใช้งาน"}`,
        )
        .join("\n")
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    )
    const a = document.createElement("a")
    a.href = url
    a.download = "BAM-equipment.csv"
    a.click()
    URL.revokeObjectURL(url)
    setToast("ส่งออกข้อมูลเรียบร้อยแล้ว")
  }
  const saveEquipment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const item: Equipment = {
      id: String(data.get("code")),
      name: String(data.get("name")),
      detail: String(data.get("detail")),
      type: String(data.get("type")),
      status: data.get("active") === "on",
      room,
      floor,
      building,
    }
    if (equipment.some((e) => e.id === item.id && e.id !== editing?.id)) {
      setToast("รหัสอุปกรณ์นี้มีอยู่แล้ว กรุณาใช้รหัสอื่น")
      return
    }
    setEquipment((prev) =>
      editing
        ? prev.map((e) => (e.id === editing.id ? item : e))
        : [...prev, item],
    )
    setModal(null)
    setEditing(null)
    setToast("บันทึกข้อมูลอุปกรณ์เรียบร้อยแล้ว")
  }
  const otherRows: Record<string, string[]> = {
    หน่วยงานและอาคาร: [
      "Data and Digitization",
      "ฝ่ายทรัพยากรบุคคล",
      "Marketing",
      "ฝ่ายบริหาร",
    ],
    ประเภทอุปกรณ์: ["เครื่องปรับอากาศ", "อุปกรณ์ไอที", "ระบบไฟฟ้า", "เฟอร์นิเจอร์"],
    การแจ้งซ่อม: ["ระบบปรับอากาศ", "ระบบไฟฟ้าและแสงสว่าง", "อุปกรณ์คอมพิวเตอร์"],
    การจองรถ: ["รถยนต์ส่วนกลาง", "รถตู้ส่วนกลาง"],
    การจองห้องประชุม: ["ห้องประชุม 101", "ห้องประชุม 201", "ห้องประชุมใหญ่"],
    ผู้ใช้งาน: ["ปวีณา ศรีสุข", "ธนกร วัฒนกุล", "สุภาวดี ใจดี"],
    บทบาทและสิทธิ์: ["ผู้ดูแลระบบ", "เจ้าหน้าที่", "ผู้ใช้งานทั่วไป"],
  }
  const rows = [...(otherRows[page] || []), ...(extraRows[page] || [])].filter(
    (r) => r.toLowerCase().includes(search.toLowerCase()),
  )
  return (
    <div className="app">
      <header className="navbar" ref={dropdownRef}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            navigate(0)
          }}
          aria-label="BAM หน้าหลัก"
        >
          <img src="/bam-logo.png" alt="BAM" />
          <span className="brand-divider" />
          <span className="brand-caption">WORKPLACE</span>
        </a>
        <nav className="main-nav" aria-label="เมนูหลัก">
          {[
            { text: "หน้าแรก", icon: Home },
            { text: "แจ้งซ่อม", icon: Wrench },
            { text: "จองรถ", icon: Car },
            { text: "จองห้องประชุม", icon: Monitor },
          ].map((n, i) => (
            <button
              key={n.text}
              onClick={() => {
                if (i === 0) setModal("overview")
                else navigate(1, groups[1].menus[i - 1])
              }}
            >
              <n.icon size={17} />
              {n.text}
            </button>
          ))}
          <div className="nav-menu-wrap">
            <button
              className={`nav-settings ${
                dropdown === "settings" ? "is-open" : ""
              }`}
              aria-expanded={dropdown === "settings"}
              onClick={() => {
                setDropdown(dropdown === "settings" ? null : "settings")
                setHoverGroup(group)
              }}
            >
              <Settings size={17} />
              ตั้งค่าระบบ
              <ChevronDown
                size={14}
                className={dropdown === "settings" ? "rotate" : ""}
              />
            </button>
            {dropdown === "settings" && (
              <div className="settings-dropdown">
                <div className="dropdown-heading">
                  การตั้งค่าระบบ <span>SETTINGS</span>
                </div>
                <div className="dropdown-columns">
                  <div className="dropdown-groups">
                    {groups.map((g, i) => (
                      <button
                        key={g.name}
                        className={hoverGroup === i ? "hovered" : ""}
                        onMouseEnter={() => setHoverGroup(i)}
                        onClick={() => setHoverGroup(i)}
                      >
                        <IconBadge icon={g.icon} />
                        <span>
                          {g.name}
                          <small>{g.desc}</small>
                        </span>
                        <ChevronRight size={15} />
                      </button>
                    ))}
                  </div>
                  <div className="dropdown-sub">
                    <span className="eyebrow">{groups[hoverGroup].name}</span>
                    {groups[hoverGroup].menus.map((m) => (
                      <button
                        key={m}
                        className={m === page ? "selected" : ""}
                        onClick={() => navigate(hoverGroup, m)}
                      >
                        {m}
                        {m === page ? (
                          <Check size={15} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                      </button>
                    ))}
                    <div className="dropdown-tip">
                      <Info size={14} />
                      จัดการทุกอย่างได้ในที่เดียว
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>
        <div className="nav-end">
          <div className="notification-wrap">
            <button
              className="icon-button notification-button"
              aria-label="การแจ้งเตือน"
              onClick={() =>
                setDropdown(
                  dropdown === "notifications" ? null : "notifications",
                )
              }
            >
              <Bell size={20} />
              {!notified && <span className="notification-dot" />}
            </button>
            {dropdown === "notifications" && (
              <div className="small-dropdown">
                <strong>การแจ้งเตือน</strong>
                <p>
                  {notified
                    ? "คุณอ่านการแจ้งเตือนทั้งหมดแล้ว"
                    : "ยินดีต้อนรับสู่หน้าการตั้งค่าระบบรูปแบบใหม่"}
                </p>
                <button
                  className="text-button"
                  onClick={() => setNotified(true)}
                >
                  <CheckCheck size={16} />
                  ทำเครื่องหมายว่าอ่านแล้ว
                </button>
              </div>
            )}
          </div>
          <span className="nav-separator" />
          <button
            className="profile"
            onClick={() =>
              setDropdown(dropdown === "profile" ? null : "profile")
            }
            aria-expanded={dropdown === "profile"}
          >
            <span className="avatar">ปศ</span>
            <span className="profile-name">
              ปวีณา ศรีสุข<small>ผู้ดูแลระบบ</small>
            </span>
            <ChevronDown size={14} />
          </button>
          {dropdown === "profile" && (
            <div className="small-dropdown profile-dropdown">
              <strong>ปวีณา ศรีสุข</strong>
              <p>ผู้ดูแลระบบ · BAM Workplace</p>
              <button
                onClick={() => navigate(2, "ผู้ใช้งาน")}
                className="text-button"
              >
                <Users size={16} />
                จัดการผู้ใช้งาน
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main-content">
        <div className="breadcrumb">
          <Home size={14} />
          <ChevronRight size={12} />
          <span>ตั้งค่าระบบ</span>
          <ChevronRight size={12} />
          <span className="breadcrumb-current">{groups[group].name}</span>
        </div>
        <section className="page-intro">
          <div className="intro-left">
            <span className="intro-icon">
              <Settings size={27} strokeWidth={1.6} />
            </span>
            <div>
              <span className="eyebrow">WORKSPACE SETTINGS</span>
              <h1>การตั้งค่าระบบ</h1>
              <p>จัดการพื้นที่ บริการ และผู้ใช้งาน ให้ทุกวันทำงานเป็นเรื่องง่าย</p>
            </div>
          </div>
          <button className="guide-button" onClick={() => setModal("guide")}>
            <BookOpen size={17} />
            คู่มือการตั้งค่า
            <ArrowRight size={15} />
          </button>
        </section>
        <section className="settings-navigation" aria-label="หมวดการตั้งค่า">
          <div className="category-tabs" role="tablist">
            {groups.map((g, i) => (
              <button
                role="tab"
                aria-selected={group === i}
                key={g.name}
                className={group === i ? "active" : ""}
                onClick={() => navigate(i)}
              >
                <g.icon size={18} />
                <span>{g.name}</span>
                <span className="tab-count">{g.menus.length}</span>
              </button>
            ))}
          </div>
          <div className="sub-navigation">
            <span className="sub-label">เมนูในหมวดนี้</span>
            {groups[group].menus.map((m, i) => {
              const Icon =
                group === 0 ? [Building2, Users, Tag][i] : groups[group].icon
              return (
                <button
                  key={m}
                  className={page === m ? "active" : ""}
                  onClick={() => {
                    setPage(m)
                    setSearch("")
                  }}
                >
                  <Icon size={16} />
                  {m}
                  {page === m && <span className="active-dot" />}
                </button>
              )
            })}
          </div>
        </section>
        <section className="section-heading">
          <div>
            <h2>
              {page}
              <span className="soft-tag">
                {group === 0 ? "ข้อมูลกลาง" : "ตั้งค่าระบบ"}
              </span>
            </h2>
            <p>
              {page === "อาคารและอุปกรณ์"
                ? "จัดการอาคาร ห้อง และอุปกรณ์ที่ติดตั้ง เพื่อเชื่อมต่อกับบริการในระบบ"
                : `จัดการข้อมูล${page}และกำหนดค่าการใช้งานภายในองค์กร`}
            </p>
          </div>
          {page === "อาคารและอุปกรณ์" ? (
            <button className="button secondary" onClick={exportData}>
              <ArrowDownToLine size={16} />
              ส่งออกข้อมูล
            </button>
          ) : (
            !["ข้อมูลองค์กร", "การแจ้งเตือน"].includes(page) && (
              <button
                className="button primary"
                onClick={() => setModal("add-row")}
              >
                <Plus size={17} />
                เพิ่ม{page === "ประเภทอุปกรณ์" ? "ประเภท" : "รายการ"}
              </button>
            )
          )}
        </section>

        {page === "อาคารและอุปกรณ์" ? (
          <>
            <div className="workspace-grid">
              <aside className="location-panel">
                <div className="panel-title">
                  <span>
                    <MapPin size={17} />
                    เลือกพื้นที่
                  </span>
                  <span className="muted">LOCATION</span>
                </div>
                <div className="location-content">
                  <div className="field-heading">
                    <label htmlFor="building">อาคาร</label>
                    <span>2 อาคาร</span>
                  </div>
                  <div className="select-with-icon">
                    <Building2 size={17} />
                    <select
                      id="building"
                      value={building}
                      onChange={(e) => {
                        setBuilding(e.target.value)
                        setSelected([])
                      }}
                    >
                      <option>อาคาร 1.1</option>
                      <option>อาคาร 1.2</option>
                    </select>
                    <ChevronDown size={15} />
                  </div>
                  <div className="field-heading floor-heading">
                    <label>ชั้น</label>
                    <span>6 ชั้น</span>
                  </div>
                  <div className="floor-grid">
                    {[1, 2, 3, 4, 5, 6].map((f) => (
                      <button
                        key={f}
                        className={floor === f ? "active" : ""}
                        onClick={() => {
                          setFloor(f)
                          setSelected([])
                        }}
                      >
                        ชั้น {f}
                      </button>
                    ))}
                  </div>
                  <div className="room-list-heading">
                    <span>ห้อง / พื้นที่</span>
                    <span className="count-badge">6</span>
                  </div>
                  <div className="rooms">
                    {roomNames.map((r, i) => (
                      <button
                        key={r}
                        className={room === r ? "active" : ""}
                        onClick={() => {
                          setRoom(r)
                          setSearch("")
                          setSelected([])
                        }}
                      >
                        <DoorOpen size={17} />
                        <span>{i === 1 ? `ห้องประชุม ${floor}01` : r}</span>
                        <span className="room-count">{countRoom(r)}</span>
                        {room === r && <ChevronRight size={13} />}
                      </button>
                    ))}
                  </div>
                  <button
                    className="add-room"
                    onClick={() => setModal("room-info")}
                  >
                    <Plus size={15} />
                    จัดการห้องและพื้นที่
                  </button>
                </div>
                <div className="location-note">
                  <Info size={15} />
                  <span>
                    เลือกห้องเพื่อดูและจัดการอุปกรณ์
                    <br />
                    ที่ติดตั้งภายในห้องนั้น
                  </span>
                </div>
              </aside>
              <section className="equipment-panel">
                <div className="room-header">
                  <div>
                    <div className="room-breadcrumb">
                      <Building2 size={13} />
                      {building}
                      <ChevronRight size={12} />
                      ชั้น {floor}
                    </div>
                    <h3>
                      {room === roomNames[1] ? `ห้องประชุม ${floor}01` : room}
                      <button
                        className="edit-name"
                        aria-label="ข้อมูลห้อง"
                        onClick={() => setModal("room-info")}
                      >
                        <Pencil size={14} />
                      </button>
                    </h3>
                    <div className="room-meta">
                      <span className="green-dot" />
                      พื้นที่พร้อมใช้งาน<span className="meta-divider">|</span>
                      <DoorOpen size={13} />
                      ห้อง {floor}0{roomNames.indexOf(room) + 1}
                    </div>
                  </div>
                  <button
                    className="button primary"
                    onClick={() => {
                      setEditing(null)
                      setModal("equipment")
                    }}
                  >
                    <Plus size={18} />
                    เพิ่มอุปกรณ์
                  </button>
                </div>
                <div className="room-stats">
                  <div>
                    <IconBadge icon={Box} />
                    <span>
                      อุปกรณ์ทั้งหมด
                      <strong>
                        {roomEquipment.length}
                        <small>รายการ</small>
                      </strong>
                    </span>
                  </div>
                  <div>
                    <IconBadge icon={CheckCheck} className="green" />
                    <span>
                      พร้อมใช้งาน
                      <strong>
                        {roomEquipment.filter((e) => e.status).length}
                        <small>รายการ</small>
                      </strong>
                    </span>
                  </div>
                  <div>
                    <IconBadge icon={Wrench} className="amber" />
                    <span>
                      ไม่ใช้งาน
                      <strong>
                        {roomEquipment.filter((e) => !e.status).length}
                        <small>รายการ</small>
                      </strong>
                    </span>
                  </div>
                </div>
                <div className="equipment-toolbar">
                  <div className="search-input">
                    <Search size={17} />
                    <input
                      aria-label="ค้นหาอุปกรณ์"
                      placeholder="ค้นหาชื่อหรือรหัสอุปกรณ์..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        aria-label="ล้างคำค้นหา"
                        onClick={() => setSearch("")}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <div className="filter-select">
                    <SlidersHorizontal size={15} />
                    <select
                      aria-label="ประเภทอุปกรณ์"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      {[
                        "ทุกประเภท",
                        "เครื่องปรับอากาศ",
                        "อุปกรณ์ไอที",
                        "ระบบไฟฟ้า",
                        "เฟอร์นิเจอร์",
                      ].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} />
                  </div>
                </div>
                {selected.length > 0 && (
                  <div className="selection-bar">
                    <span>เลือก {selected.length} รายการ</span>
                    <button onClick={() => setModal("delete-selected")}>
                      <Trash2 size={14} />
                      ลบรายการที่เลือก
                    </button>
                    <button onClick={() => setSelected([])}>ยกเลิก</button>
                  </div>
                )}
                <div className="table-scroll">
                  <table className="equipment-table">
                    <thead>
                      <tr>
                        <th className="check-cell">
                          <input
                            type="checkbox"
                            aria-label="เลือกอุปกรณ์ทั้งหมด"
                            checked={
                              visible.length > 0 &&
                              visible.every((e) => selected.includes(e.id))
                            }
                            onChange={(e) =>
                              setSelected(
                                e.target.checked
                                  ? visible.map((e) => e.id)
                                  : [],
                              )
                            }
                          />
                        </th>
                        <th>ชื่ออุปกรณ์</th>
                        <th>ประเภท</th>
                        <th>สถานะ</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((e) => {
                        const Icon = typeIcon(e.type)
                        return (
                          <tr key={e.id}>
                            <td className="check-cell">
                              <input
                                type="checkbox"
                                aria-label={`เลือก ${e.name}`}
                                checked={selected.includes(e.id)}
                                onChange={(ev) =>
                                  setSelected(
                                    ev.target.checked
                                      ? [...selected, e.id]
                                      : selected.filter((id) => id !== e.id),
                                  )
                                }
                              />
                            </td>
                            <td>
                              <div className="equipment-name">
                                <span
                                  className={`equipment-icon ${
                                    e.type === "อุปกรณ์ไอที" ? "purple" : ""
                                  }`}
                                >
                                  <Icon size={21} strokeWidth={1.5} />
                                </span>
                                <div>
                                  <button
                                    onClick={() => {
                                      setEditing(e)
                                      setModal("equipment")
                                    }}
                                  >
                                    {e.name}
                                  </button>
                                  <span>
                                    {e.id}
                                    <span className="detail-separator">·</span>
                                    {e.detail}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="type-tag">{e.type}</span>
                            </td>
                            <td>
                              <span
                                className={`status-tag ${
                                  e.status ? "available" : "inactive"
                                }`}
                              >
                                <span />
                                {e.status ? "พร้อมใช้งาน" : "ไม่ใช้งาน"}
                              </span>
                            </td>
                            <td>
                              <button
                                className="row-action"
                                aria-label={`แก้ไข ${e.name}`}
                                onClick={() => {
                                  setEditing(e)
                                  setModal("equipment")
                                }}
                              >
                                <Ellipsis size={19} />
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {visible.length === 0 && (
                    <div className="empty-state">
                      <IconBadge icon={search ? Search : Box} />
                      <h3>{search ? "ไม่พบอุปกรณ์ที่ค้นหา" : "ยังไม่มีอุปกรณ์ในพื้นที่นี้"}</h3>
                      <p>
                        {search
                          ? "ลองเปลี่ยนคำค้นหาหรือตัวกรองอีกครั้ง"
                          : "เพิ่มอุปกรณ์เพื่อเริ่มต้นจัดการพื้นที่ของคุณ"}
                      </p>
                      <button
                        className="button secondary"
                        onClick={() => {
                          if (search) {
                            setSearch("")
                            setFilter("ทุกประเภท")
                          } else {
                            setEditing(null)
                            setModal("equipment")
                          }
                        }}
                      >
                        {search ? "ล้างตัวกรอง" : "เพิ่มอุปกรณ์ชิ้นแรก"}
                      </button>
                    </div>
                  )}
                </div>
                <div className="table-footer">
                  <span>
                    แสดง {visible.length ? 1 : 0}–{visible.length} จาก{" "}
                    {visible.length} รายการ
                  </span>
                  <div>
                    <button
                      className="pagination-arrow"
                      disabled
                      aria-label="หน้าก่อน"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <button className="page-number" aria-current="page">
                      1
                    </button>
                    <button
                      className="pagination-arrow"
                      disabled
                      aria-label="หน้าถัดไป"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
                <div className="panel-bottom">
                  <label>
                    <input
                      type="checkbox"
                      checked={showInactive}
                      onChange={(e) => setShowInactive(e.target.checked)}
                    />
                    แสดงอุปกรณ์ที่ไม่ใช้งาน
                  </label>
                  <span>
                    <Info size={13} />
                    ข้อมูลอุปกรณ์ใช้สำหรับการแจ้งซ่อม
                  </span>
                </div>
              </section>
            </div>
            <div className="help-banner">
              <span className="help-icon">
                <Layers size={20} />
              </span>
              <div>
                <strong>จัดระเบียบข้อมูลให้พร้อม เชื่อมต่อทุกบริการได้ง่ายขึ้น</strong>
                <p>
                  อาคารและอุปกรณ์จะถูกเชื่อมโยงกับการแจ้งซ่อมและการจองห้องประชุมโดยอัตโนมัติ
                </p>
              </div>
              <button onClick={() => setModal("guide")}>
                เรียนรู้เพิ่มเติม
                <ArrowRight size={15} />
              </button>
            </div>
          </>
        ) : page === "ข้อมูลองค์กร" ? (
          <form
            className="generic-panel organization-form"
            onSubmit={(e) => {
              e.preventDefault()
              setToast("บันทึกการตั้งค่าในตัวอย่างนี้แล้ว")
            }}
          >
            <IconBadge icon={Building2} />
            <h3>ข้อมูลพื้นฐานขององค์กร</h3>
            <label>
              ชื่อองค์กร
              <input
                required
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
              />
            </label>
            <label>
              ชื่อที่แสดงในระบบ
              <input required defaultValue="BAM Workplace" />
            </label>
            <label>
              อีเมลติดต่อ
              <input type="email" defaultValue="contact@bam.co.th" />
            </label>
            <button className="button primary" type="submit">
              บันทึกการเปลี่ยนแปลง
            </button>
          </form>
        ) : page === "การแจ้งเตือน" ? (
          <div className="generic-panel">
            <h3>การแจ้งเตือนในระบบ</h3>
            <div className="notification-setting">
              <div>
                <strong>รับการแจ้งเตือนกิจกรรม</strong>
                <p>แจ้งเตือนเมื่อมีการแจ้งซ่อม การจอง และการอัปเดตสถานะ</p>
              </div>
              <button
                className={`toggle ${notificationOn ? "on" : ""}`}
                role="switch"
                aria-checked={notificationOn}
                aria-label="รับการแจ้งเตือน"
                onClick={() => setNotificationOn(!notificationOn)}
              >
                <span />
              </button>
            </div>
          </div>
        ) : (
          <div className="generic-panel">
            <div className="generic-toolbar">
              <div className="search-input">
                <Search size={17} />
                <input
                  placeholder={`ค้นหา${page}...`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <span className="muted">{rows.length} รายการ</span>
            </div>
            <div className="generic-table-heading">
              <span>ชื่อ{page}</span>
              <span>สถานะ</span>
            </div>
            {rows.map((r, i) => (
              <div className="generic-row" key={r}>
                <IconBadge
                  icon={
                    group === 2
                      ? Users
                      : page === "ประเภทอุปกรณ์"
                        ? typeIcon(r)
                        : Building2
                  }
                />
                <div>
                  <strong>{r}</strong>
                  <small>
                    {group === 2
                      ? `BAM-${String(i + 1).padStart(3, "0")}`
                      : `เชื่อมโยงกับ ${building}`}
                  </small>
                </div>
                <span className="status-tag available">
                  <span />
                  เปิดใช้งาน
                </span>
                <button
                  className="icon-button"
                  aria-label={`ดูข้อมูล ${r}`}
                  onClick={() => {
                    setModal(`detail:${r}`)
                  }}
                >
                  <ChevronRight size={17} />
                </button>
              </div>
            ))}
            {rows.length === 0 && (
              <div className="empty-state">
                <Search />
                <h3>ไม่พบรายการที่ค้นหา</h3>
              </div>
            )}
            <div className="generic-note">
              <Info size={15} />
              ข้อมูลตัวอย่างสำหรับแสดงรูปแบบการตั้งค่า
            </div>
          </div>
        )}
        <footer className="page-footer">
          <span>
            © 2026 BAM Workplace <span>·</span> ทุกพื้นที่ทำงาน เชื่อมถึงกัน
          </span>
          <div>
            <span className="green-dot" />
            ระบบพร้อมใช้งาน<span className="footer-divider">|</span>
            <button onClick={() => setModal("guide")}>
              <CircleHelp size={14} />
              ศูนย์ช่วยเหลือ
            </button>
          </div>
        </footer>
      </main>
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button aria-label="ปิดข้อความ" onClick={() => setToast("")}>
            <X size={15} />
          </button>
        </div>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="ปิด"
              onClick={() => setModal(null)}
            >
              <X size={20} />
            </button>
            {modal === "equipment" ? (
              <>
                <IconBadge icon={Box} />
                <h2 id="modal-title">
                  {editing ? "แก้ไขอุปกรณ์" : "เพิ่มอุปกรณ์ใหม่"}
                </h2>
                <p className="modal-description">
                  {building} · ชั้น {floor} · {room}
                </p>
                <form onSubmit={saveEquipment} className="modal-form">
                  <label>
                    ชื่ออุปกรณ์
                    <input
                      name="name"
                      required
                      autoFocus
                      defaultValue={editing?.name}
                      placeholder="เช่น เครื่องปรับอากาศ Daikin"
                    />
                  </label>
                  <div className="form-two">
                    <label>
                      รหัสอุปกรณ์
                      <input
                        name="code"
                        required
                        defaultValue={editing?.id}
                        placeholder="เช่น AC-004"
                      />
                    </label>
                    <label>
                      ประเภท
                      <select name="type" defaultValue={editing?.type}>
                        {[
                          "เครื่องปรับอากาศ",
                          "อุปกรณ์ไอที",
                          "ระบบไฟฟ้า",
                          "เฟอร์นิเจอร์",
                        ].map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label>
                    รายละเอียด / รุ่น
                    <input
                      name="detail"
                      defaultValue={editing?.detail}
                      placeholder="ยี่ห้อ รุ่น หรือรายละเอียดเพิ่มเติม"
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      name="active"
                      defaultChecked={editing?.status ?? true}
                    />
                    พร้อมใช้งาน
                  </label>
                  <div className="modal-actions">
                    {editing && (
                      <button
                        type="button"
                        className="button danger"
                        onClick={() => setModal("delete-one")}
                      >
                        <Trash2 size={15} />
                        ลบ
                      </button>
                    )}
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setModal(null)}
                    >
                      ยกเลิก
                    </button>
                    <button type="submit" className="button primary">
                      <Check size={16} />
                      บันทึกอุปกรณ์
                    </button>
                  </div>
                </form>
              </>
            ) : modal.startsWith("delete-") ? (
              <>
                <IconBadge icon={Trash2} />
                <h2 id="modal-title">ยืนยันการลบอุปกรณ์</h2>
                <p>
                  คุณต้องการลบ{" "}
                  {modal === "delete-one"
                    ? editing?.name
                    : `${selected.length} รายการที่เลือก`}{" "}
                  ใช่หรือไม่?
                </p>
                <div className="modal-actions">
                  <button
                    className="button secondary"
                    onClick={() => setModal(null)}
                  >
                    ยกเลิก
                  </button>
                  <button
                    className="button danger"
                    onClick={() => {
                      setEquipment((prev) =>
                        prev.filter((e) =>
                          modal === "delete-one"
                            ? e.id !== editing?.id
                            : !selected.includes(e.id),
                        ),
                      )
                      setSelected([])
                      setModal(null)
                      setToast("ลบอุปกรณ์เรียบร้อยแล้ว")
                    }}
                  >
                    ยืนยันการลบ
                  </button>
                </div>
              </>
            ) : modal === "add-row" ? (
              <>
                <IconBadge icon={Plus} />
                <h2 id="modal-title">เพิ่ม{page}</h2>
                <p className="modal-description">
                  เพิ่มรายการเพื่อทดลองการตั้งค่าในหน้าตัวอย่าง
                </p>
                <form
                  className="modal-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const name = String(
                      new FormData(e.currentTarget).get("name"),
                    )
                    setExtraRows((prev) => ({
                      ...prev,
                      [page]: [...(prev[page] || []), name],
                    }))
                    setModal(null)
                    setToast("เพิ่มรายการในตัวอย่างนี้แล้ว")
                  }}
                >
                  <label>
                    ชื่อรายการ
                    <input
                      name="name"
                      autoFocus
                      required
                      placeholder="ระบุชื่อรายการ"
                    />
                  </label>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => setModal(null)}
                    >
                      ยกเลิก
                    </button>
                    <button type="submit" className="button primary">
                      เพิ่มรายการ
                    </button>
                  </div>
                </form>
              </>
            ) : modal === "room-info" ? (
              <>
                <IconBadge icon={DoorOpen} />
                <h2 id="modal-title">ข้อมูลห้องและพื้นที่</h2>
                <div className="info-details">
                  <p>
                    <span>ห้อง / พื้นที่</span>
                    <strong>{room}</strong>
                  </p>
                  <p>
                    <span>ตำแหน่ง</span>
                    <strong>
                      {building} · ชั้น {floor}
                    </strong>
                  </p>
                  <p>
                    <span>อุปกรณ์ในห้อง</span>
                    <strong>{roomEquipment.length} รายการ</strong>
                  </p>
                </div>
                <div className="info-callout">
                  <Info size={17} />
                  หน้านี้เป็นตัวอย่างการจัดวางเมนูและอุปกรณ์
                  การแก้ไขโครงสร้างพื้นที่ต้องเชื่อมต่อระบบข้อมูลจริง
                </div>
                <button
                  className="button primary full-width"
                  onClick={() => setModal(null)}
                >
                  เข้าใจแล้ว
                </button>
              </>
            ) : modal.startsWith("detail:") ? (
              <>
                <IconBadge icon={FileText} />
                <h2 id="modal-title">{modal.slice(7)}</h2>
                <p className="modal-description">
                  {page} · {groups[group].name}
                </p>
                <div className="info-details">
                  <p>
                    <span>สถานะ</span>
                    <span className="status-tag available">
                      <span />
                      เปิดใช้งาน
                    </span>
                  </p>
                  <p>
                    <span>องค์กร</span>
                    <strong>BAM Workplace</strong>
                  </p>
                </div>
                <button
                  className="button primary full-width"
                  onClick={() => setModal(null)}
                >
                  ปิดรายละเอียด
                </button>
              </>
            ) : (
              <>
                <IconBadge icon={BookOpen} />
                <h2 id="modal-title">
                  {modal === "overview"
                    ? "ยินดีต้อนรับสู่ BAM Workplace"
                    : "ตั้งค่าง่าย ๆ ในไม่กี่ขั้นตอน"}
                </h2>
                <p className="modal-description">
                  ทุกการตั้งค่า เชื่อมต่อการทำงานขององค์กรให้เป็นหนึ่งเดียว
                </p>
                <div className="guide-steps">
                  {[
                    {
                      icon: Building2,
                      title: "จัดการสถานที่และอุปกรณ์",
                      text: "เลือกอาคาร ชั้น และห้อง จากนั้นเพิ่มอุปกรณ์ในพื้นที่",
                    },
                    {
                      icon: Wrench,
                      title: "กำหนดบริการขององค์กร",
                      text: "ตั้งค่าการแจ้งซ่อม การจองรถ และการจองห้องประชุม",
                    },
                    {
                      icon: ShieldCheck,
                      title: "ดูแลผู้ใช้งานและสิทธิ์",
                      text: "กำหนดบทบาทและการเข้าถึงให้เหมาะกับทีมของคุณ",
                    },
                  ].map((s, i) => (
                    <div key={s.title}>
                      <IconBadge icon={s.icon} />
                      <div>
                        <strong>
                          {i + 1}. {s.title}
                        </strong>
                        <p>{s.text}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="info-callout">
                  <Info size={17} />
                  นี่คือหน้าตัวอย่าง UI ข้อมูลที่เพิ่มหรือแก้ไขจะอยู่เฉพาะระหว่างการใช้งานครั้งนี้
                </div>
                <button
                  className="button primary full-width"
                  onClick={() => setModal(null)}
                >
                  เริ่มต้นใช้งาน
                  <ArrowRight size={16} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
