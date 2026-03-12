import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, Route, createRoutesFromElements } from "react-router-dom";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ProfileSetup from "./pages/ProfileSetup";
import Questionnaire from "./pages/Questionnaire";
import QuestionnaireIntro from "./pages/QuestionnaireIntro";
import Matches from "./pages/Matches";
import Event from "./pages/Event";
import Dates from "./pages/Dates";
import DatesList from "./pages/DatesList";
import Profile from "./pages/Profile";
import ChangePassword from "./pages/ChangePassword";
import AuthConfirm from "./pages/AuthConfirm";
import AboutUs from "./pages/AboutUs";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import Footer from "./pages/Footer";
import Terms from "./pages/Terms";
import PartnerVenues from "./pages/PartnerVenues";
import EventCuration from "./pages/EventCuration";
import MainLayout from "./components/MainLayout";
import Bg3 from "@/assets/bg3.webp";
import CloudsBg from "@/assets/index-clouds.webp";

const queryClient = new QueryClient();

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<Index />} />

      {/* Main Layout Routes */}
      <Route element={<MainLayout />}>
        <Route path="/auth" element={<Auth />} />
        <Route path="/auth/confirm" element={<AuthConfirm />} />
        <Route path="/profile-setup" element={<ProfileSetup />} />
        <Route path="/matches" element={<Matches />} />
        {/* <Route path="/event" element={<Event />} /> */}
        <Route path="/dates" element={<DatesList />} />
        <Route path="/dates/:id" element={<Dates />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/change-password/*" element={<ChangePassword />} />
        {/* <Route path="/ourstory" element={<OurStory />} /> */}
        <Route path="/about" element={<AboutUs />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/admin" element={<Admin />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Collab Routes (custom clouds background) */}
      <Route element={<MainLayout backgroundImage={CloudsBg} footerOverlay={true} useCollabBackdrop={true} />}>
        <Route path="/partner-venues" element={<PartnerVenues />} />
        <Route path="/event-curation" element={<EventCuration />} />
      </Route>

      {/* Questionnaire Layout Routes (with bg3.png) */}
      <Route element={<MainLayout />}>
        <Route path="/questionnaire/:type?" element={<Questionnaire />} />
        <Route path="/questionnaire-intro" element={<QuestionnaireIntro />} />
      </Route>
    </>
  )
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <RouterProvider router={router} />
    </TooltipProvider>


  </QueryClientProvider>
);

export default App;
