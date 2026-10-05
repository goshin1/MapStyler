import { createApp } from 'vue'
import 'maplibre-gl/dist/maplibre-gl.css'
import './map/worker'
import './map/pmtiles'
import './style.css'
import App from './App.vue'

createApp(App).mount('#app')
