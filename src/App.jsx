import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import { SkeletonPage } from "./components/Loader";

const Welcome = lazy(() => import("./pages/Welcome"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Suggestions = lazy(() => import("./pages/Suggestions"));
const InterviewStart = lazy(() => import("./pages/InterviewStart"));
const InterviewSession = lazy(() => import("./pages/InterviewSession"));
const InterviewSummary = lazy(() => import("./pages/InterviewSummary"));
const ResumeUpload = lazy(() => import("./pages/ResumeUpload"));
const ResumeAnalyze = lazy(() => import("./pages/ResumeAnalyze"));
const ResumeAnalysesList = lazy(() => import("./pages/ResumeAnalysesList"));
const ResumeAnalysisDetail = lazy(() => import("./pages/ResumeAnalysisDetail"));
const ResumeBuilder = lazy(() => import("./pages/ResumeBuilder"));
const Profile = lazy(() => import("./pages/Profile"));

function HomeRedirect() {
  const { user } = useAuth();
  return user ? <Navigate to="/dashboard" replace /> : <Welcome />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Navbar />
        <Suspense fallback={<SkeletonPage />}>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/suggestions" element={<ProtectedRoute><Suggestions /></ProtectedRoute>} />
          <Route path="/interview" element={<ProtectedRoute><InterviewStart /></ProtectedRoute>} />
          <Route path="/interview/:sessionId" element={<ProtectedRoute><InterviewSession /></ProtectedRoute>} />
          <Route path="/interview/:sessionId/summary" element={<ProtectedRoute><InterviewSummary /></ProtectedRoute>} />
          <Route path="/resumes" element={<ProtectedRoute><ResumeUpload /></ProtectedRoute>} />
          <Route path="/resumes/:resumeId/analyze" element={<ProtectedRoute><ResumeAnalyze /></ProtectedRoute>} />
          <Route path="/resumes/:resumeId/analyses" element={<ProtectedRoute><ResumeAnalysesList /></ProtectedRoute>} />
          <Route path="/resumes/:resumeId/analyses/:analysisId" element={<ProtectedRoute><ResumeAnalysisDetail /></ProtectedRoute>} />
          <Route path="/resume-builder" element={<ProtectedRoute><ResumeBuilder /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/builder" element={<Navigate to="/resume-builder" replace />} />
          <Route path="/skills" element={<Navigate to="/profile" replace />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
