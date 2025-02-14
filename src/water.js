import { MeshReflectorMaterial } from "@react-three/drei";
import { Color, PlaneGeometry } from "three";

export function Water()
{
    return (
        <mesh rotation-x = {-Math.PI * 0.5} castShadow receiveShadow>
            <planeGeometry args={[128,128]} />
            
        </mesh>
    )
}