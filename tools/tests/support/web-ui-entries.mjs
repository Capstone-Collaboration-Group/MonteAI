import React from "react";
// Avoid evaluating unrelated PDF/analytics UI barrels in Node. All signup and
// protected-route components below are the actual production TS/TSX modules.
export { RegistrationForm } from "../../../packages/ui/src/components/auth/RegistrationForm.tsx";
export { StudentIdVerification } from "../../../packages/ui/src/components/auth/StudentIdVerification.tsx";
export { PendingRegistrationGate } from "../../../packages/ui/src/components/auth/PendingRegistrationGate.tsx";
export { ProtectedRoute } from "../../../packages/ui/src/components/auth/ProtectedRoute.tsx";
export { Modal } from "../../../packages/ui/src/components/auth/Modal.tsx";
export { LeftPanel } from "../../../packages/ui/src/components/auth/LeftPanel.tsx";
export { Card } from "../../../packages/ui/src/components/Card.tsx";
export function Toaster() { return null; }
export function NotFound({ onGoHome }) { return React.createElement("button", { onClick: onGoHome }, "Go home"); }
