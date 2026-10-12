import { useMemo, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType, type Edge, type Node } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { COURT, aVerifier, formatAire, formatRef, moisAnnee } from "./libelles";
import type { Graphe } from "./types";

interface Props {
  graphe: Graphe;
  onSelectVersion: (versionId: number) => void;
}

const W = 150;
const H = 56;
const SEUIL_REPLI = 150; // au-delà, on replie les gros événements
const LOTS_MIN = 20; // un événement à plus de 20 enfants devient un nœud « N lots »

type Repli = { id: string; evt: string; source: number; n: number };

export default function GrapheTab({ graphe, onSelectVersion }: Props) {
  const [deplies, setDeplies] = useState<Set<string>>(new Set());
  const trop = graphe.nodes.length > SEUIL_REPLI;

  const { nodes, edges } = useMemo(() => {
    // 1. Repli : enfants d'un même événement remplacés par un nœud de synthèse.
    const masques = new Set<number>();
    const replis: Repli[] = [];
    if (trop) {
      const parEvt = new Map<string, typeof graphe.edges>();
      for (const e of graphe.edges) parEvt.set(e.evt_id, [...(parEvt.get(e.evt_id) ?? []), e]);
      for (const [evt, es] of parEvt) {
        const cibles = new Set(es.map((e) => e.target));
        if (cibles.size < LOTS_MIN || deplies.has(evt)) continue;
        cibles.forEach((t) => t !== graphe.racine && masques.add(t));
        replis.push({ id: `repli:${evt}`, evt, source: es[0].source, n: cibles.size });
      }
    }

    const visibles = graphe.nodes.filter((n) => !masques.has(n.id));
    const aretes = graphe.edges.filter((e) => !masques.has(e.source) && !masques.has(e.target));

    // 2. Mise en page dagre, de gauche à droite dans le sens du temps.
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: "LR", nodesep: 18, ranksep: 70 });
    g.setDefaultEdgeLabel(() => ({}));
    visibles.forEach((n) => g.setNode(String(n.id), { width: W, height: H }));
    replis.forEach((r) => g.setNode(r.id, { width: W, height: H }));
    aretes.forEach((e) => g.setEdge(String(e.source), String(e.target)));
    replis.forEach((r) => g.setEdge(String(r.source), r.id));
    dagre.layout(g);

    const pos = (id: string) => {
      const p = g.node(id);
      return { x: p.x - W / 2, y: p.y - H / 2 };
    };

    const rfNodes: Node[] = [
      ...visibles.map((n) => ({
        id: String(n.id),
        position: pos(String(n.id)),
        data: {
          label: (
            <div className="text-left leading-tight">
              <div className="text-xs font-semibold">{formatRef(n.idu)}</div>
              <div className="text-[10px] text-slate-500">{formatAire(n.aire_m2)}</div>
              <div className="text-[10px] text-slate-500">
                {moisAnnee(n.valid_from)} → {n.valid_to ? moisAnnee(n.valid_to) : "auj."}
              </div>
            </div>
          ),
          versionId: n.id,
        },
        style: {
          width: W,
          padding: 6,
          borderRadius: 6,
          border: n.racine ? "2px solid #E53E3E" : "1px solid #cbd5e1",
          background: n.valid_to ? "#f8fafc" : "#ffffff",
        },
      })),
      ...replis.map((r) => ({
        id: r.id,
        position: pos(r.id),
        data: { label: <div className="text-xs">{r.n} lots, cliquer pour déplier</div>, evt: r.evt },
        style: { width: W, padding: 6, borderRadius: 6, border: "1px dashed #94a3b8", background: "#f1f5f9" },
      })),
    ];

    const rfEdges: Edge[] = [
      ...aretes.map((e) => {
        const doute = aVerifier(e.flags);
        return {
          id: `${e.evt_id}:${e.source}:${e.target}`,
          source: String(e.source),
          target: String(e.target),
          label: COURT[e.type] ?? e.type,
          labelStyle: { fontSize: 10 },
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: doute ? "#dc2626" : "#64748b", strokeDasharray: e.meme_id ? "4 3" : undefined },
        };
      }),
      ...replis.map((r) => ({
        id: `${r.id}:e`, source: String(r.source), target: r.id,
        markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#64748b" },
      })),
    ];

    return { nodes: rfNodes, edges: rfEdges };
  }, [graphe, deplies, trop]);

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      {trop ? (
        <p className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900">
          {graphe.nodes.length} parcelles liées : les opérations à plus de {LOTS_MIN} parcelles sont repliées.
        </p>
      ) : null}
      <p className="px-4 py-1.5 text-[11px] text-slate-500">
        Origines à gauche, descendance à droite. Cliquez une parcelle pour la sélectionner. Pointillés : même parcelle, géométrie corrigée.
      </p>
      <div className="min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          nodesDraggable={false}
          nodesConnectable={false}
          onNodeClick={(_, n) => {
            const d = n.data as { versionId?: number; evt?: string };
            if (d.evt) setDeplies((s) => new Set(s).add(d.evt!));
            else if (d.versionId) onSelectVersion(d.versionId);
          }}
        >
          <Background gap={16} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}