import { library } from '@fortawesome/fontawesome-svg-core'
import { 
  faHome, 
  faDashboard, 
  faCog, 
  faUser, 
  faSignOutAlt,
  faPlus,
  faEdit,
  faTrash,
  faEye,
  faCheck,
  faTimes,
  faSpinner,
  faExclamationTriangle,
  faInfoCircle,
  faCheckCircle,
  faTimesCircle,
  faBuilding,
  faKey,
  faDatabase,
  faPlayCircle,
  faTachometerAlt,
  faUnlink,
  faLink,
  faSync,
  faShieldAlt,
  faUsers,
  faUserCheck,
  faChartLine,
  faClock,
  faHistory,
  faUser as faUserIcon,
  faRefresh,
  faInbox,
  faBolt,
  faExternalLinkAlt,
  faProjectDiagram as faWebhook
} from '@fortawesome/free-solid-svg-icons'
import { faGithub, faTwitter } from '@fortawesome/free-brands-svg-icons'

// Add icons to the library
library.add(
  // Navigation icons
  faHome,
  faDashboard,
  faCog,
  faUser,
  faSignOutAlt,
  
  // Action icons
  faPlus,
  faEdit,
  faTrash,
  faEye,
  faCheck,
  faTimes,
  
  // Status icons
  faSpinner,
  faExclamationTriangle,
  faInfoCircle,
  faCheckCircle,
  faTimesCircle,
  
  // Form icons
  faBuilding,
  faKey,
  faDatabase,
  faPlayCircle,
  
  // Dashboard icons
  faTachometerAlt,
  faUnlink,
  faLink,
  faSync,
  faShieldAlt,
  faUsers,
  faUserCheck,
  faChartLine,
  faClock,
  faHistory,
  faUserIcon,
  faRefresh,
  faInbox,
  faBolt,
  faExternalLinkAlt,
  faWebhook,
  
  // Brand icons
  faGithub,
  faTwitter
)

export default library
