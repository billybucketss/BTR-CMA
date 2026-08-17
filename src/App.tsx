import { useState } from "react";
import { useProperties } from "./lib/store";
import Home from "./components/Home";
import CompDatabase from "./components/CompDatabase";
import CostarImport from "./components/CostarImport";
import CMABuilder from "./components/CMABuilder";

type View = "home" | "database" | "cma";

export default function App() {
  const store = useProperties();
  const [view, setView] = useState<View>("home");
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="min-h-screen bg-paper font-body text-ink">
      {/* Top nav */}
      <nav className="flex items-center justify-between border-b border-line px-6 py-3">
        <button
          onClick={() => setView("home")}
          className="flex items-center gap-2 border-none bg-transparent p-0"
        >
          <div className="h-5 w-2 rounded-sm bg-pine" />
          <span className="font-display text-[15px] font-bold tracking-tight text-ink">
            BTR CMA Workbench
          </span>
        </button>
        <div className="flex items-center gap-1">
          <NavLink active={view === "home"} onClick={() => setView("home")}>
            Home
          </NavLink>
          <NavLink active={view === "database"} onClick={() => setView("database")}>
            Comp Database
          </NavLink>
          <NavLink active={view === "cma"} onClick={() => setView("cma")}>
            CMA Builder
          </NavLink>
        </div>
      </nav>

      {view === "home" && (
        <Home
          properties={store.properties}
          onOpenDatabase={() => setView("database")}
          onImport={() => {
            setView("database");
            setShowImport(true);
          }}
          onOpenCMA={() => setView("cma")}
        />
      )}

      {view === "database" && (
        <CompDatabase
          properties={store.properties}
          addProperty={store.addProperty}
          addMany={store.addMany}
          updateProperty={store.updateProperty}
          deleteProperty={store.deleteProperty}
          deleteMany={store.deleteMany}
          ready={store.ready}
          onRequestImport={() => setShowImport(true)}
        />
      )}

      {view === "cma" && (
        <CMABuilder properties={store.properties} addProperty={store.addProperty} />
      )}

      {showImport && (
        <CostarImport
          onClose={() => setShowImport(false)}
          onImport={(props) => {
            store.addMany(props);
            setShowImport(false);
          }}
        />
      )}
    </div>
  );
}

function NavLink({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: any;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-none px-3 py-1.5 text-[13px] font-medium ${
        active ? "bg-[#EDF1EE] text-pine" : "bg-transparent text-[#6E6D64]"
      }`}
    >
      {children}
    </button>
  );
}
