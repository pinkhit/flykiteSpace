import React, { Suspense } from "react"
import { Canvas } from "@react-three/fiber";
import "./style.css"
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { BoxGeometry, MeshBasicMaterial } from "three";

import { Water } from "./water";


function Lake()
{
  return (
    <>
      <OrbitControls target={[0, 0, 0]} maxPolarAngle={1.45} />
      <PerspectiveCamera makeDefault fov={95} position={[3, 3, 3]} />
      <Water />
      <mesh>
       <boxGeometry args={[1,1,1]} />
       <meshBasicMaterial color={"red"} />
      </mesh>
    </>
  );
}


function App()
{
  return (
    <Suspense fallback={null}>
      <Canvas>
        <Lake></Lake>
      </Canvas>
    </Suspense>
  );
}

export default App;