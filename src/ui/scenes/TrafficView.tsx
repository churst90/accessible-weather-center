import type { TrafficData } from "../../core/scenes/scenes/TrafficScene";
import { SceneUnavailable } from "./SceneUnavailable";

export function TrafficView({ data }: { data: TrafficData }) {
  return <SceneUnavailable title="Traffic" placeName={data.place.name} reason={data.reason} />;
}
