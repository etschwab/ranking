import {
  BriefcaseBusiness,
  CalendarClock,
  Clapperboard,
  Gamepad2,
  Gift,
  MapPinned,
  Rocket,
  Users,
  Utensils,
  type LucideIcon,
} from 'lucide-react';

export type RankingTemplate = {
  slug: string;
  category: 'Freizeit' | 'Team & Arbeit';
  label: string;
  icon: LucideIcon;
  title: string;
  description: string;
  options: string[];
};

/**
 * Curated ranking starting points, shown both as quick-start buttons on the
 * creator form (app/page.tsx) and as a full gallery (app/vorlagen/page.tsx).
 * `slug` is a stable id used in the `?template=` query param - keep it once set.
 */
export const rankingTemplates: RankingTemplate[] = [
  {
    slug: 'reiseziele',
    category: 'Freizeit',
    label: 'Reiseziele',
    icon: MapPinned,
    title: 'Unser nächstes Reiseziel',
    description: 'Wohin soll unser nächster gemeinsamer Trip gehen?',
    options: ['Japan', 'Island', 'Portugal', 'Kanada', 'Griechenland'],
  },
  {
    slug: 'filmabend',
    category: 'Freizeit',
    label: 'Filmabend',
    icon: Clapperboard,
    title: 'Filmabend',
    description: 'Was schauen wir als Nächstes?',
    options: [
      'Dune: Part Two',
      'Parasite',
      'Interstellar',
      'Barbie',
      'The Batman',
    ],
  },
  {
    slug: 'restaurants',
    category: 'Freizeit',
    label: 'Restaurants',
    icon: Utensils,
    title: 'Wo gehen wir essen?',
    description: 'Unser nächstes gemeinsames Dinner.',
    options: [
      'Italienisch',
      'Japanisch',
      'Mexikanisch',
      'Indisch',
      'Libanesisch',
    ],
  },
  {
    slug: 'games',
    category: 'Freizeit',
    label: 'Games',
    icon: Gamepad2,
    title: 'Unsere besten Games',
    description: 'Welche Spiele gehören ganz nach oben?',
    options: [
      'Minecraft',
      'The Legend of Zelda',
      'Baldur’s Gate 3',
      'Mario Kart',
      'Fortnite',
    ],
  },
  {
    slug: 'geschenkideen',
    category: 'Freizeit',
    label: 'Geschenkideen',
    icon: Gift,
    title: 'Die besten Geschenkideen',
    description: 'Welche Idee macht am meisten Freude?',
    options: [
      'Gemeinsamer Ausflug',
      'Fotobuch',
      'Konzerttickets',
      'Wellness',
      'Lieblingsrestaurant',
    ],
  },
  {
    slug: 'bewerber',
    category: 'Team & Arbeit',
    label: 'Bewerber',
    icon: BriefcaseBusiness,
    title: 'Bewerber vergleichen',
    description: 'Gemeinsame Einschätzung für die nächste Besetzung.',
    options: ['Bewerber A', 'Bewerber B', 'Bewerber C', 'Bewerber D'],
  },
  {
    slug: 'feature-prioritaet',
    category: 'Team & Arbeit',
    label: 'Feature-Priorität',
    icon: Rocket,
    title: 'Welches Feature bauen wir als Nächstes?',
    description: 'Priorisiert gemeinsam die Roadmap für das nächste Quartal.',
    options: [
      'Onboarding verbessern',
      'Mobile App',
      'Performance-Optimierung',
      'Neues Dashboard',
      'API für Partner',
    ],
  },
  {
    slug: 'meeting-slot',
    category: 'Team & Arbeit',
    label: 'Meeting-Termin',
    icon: CalendarClock,
    title: 'Wann passt unser wöchentliches Meeting am besten?',
    description:
      'Findet gemeinsam den Termin, der für alle am wenigsten stört.',
    options: [
      'Montag 9 Uhr',
      'Dienstag 14 Uhr',
      'Mittwoch 10 Uhr',
      'Donnerstag 16 Uhr',
      'Freitag 11 Uhr',
    ],
  },
  {
    slug: 'teamausflug',
    category: 'Team & Arbeit',
    label: 'Team-Event',
    icon: Users,
    title: 'Was machen wir beim nächsten Team-Event?',
    description: 'Stimmt gemeinsam über die Aktivität für den Team-Tag ab.',
    options: [
      'Escape Room',
      'Grillnachmittag',
      'Bowling',
      'Wandertag',
      'Kochkurs',
    ],
  },
];

export function findRankingTemplate(slug: string) {
  return rankingTemplates.find((template) => template.slug === slug);
}
