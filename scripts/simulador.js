document.addEventListener('DOMContentLoaded', () => {
    
    // --- ELEMENTOS DEL DOM --- //
    const simBtnSave = document.getElementById('sim-btn-save');
    const simAudioAlert = new Audio('./sounds/alert.mp3');
    const parseForSim = (str) => str.replace(/[^0-9,]/g, '');
    const inputs = document.querySelectorAll('input[id^="sim-"]');

    // --- FORMATEO EN VIVO (Miles) --- //
    inputs.forEach(input => {
        input.addEventListener('input', (e) => {
            let val = e.target.value.replace(/[^0-9,]/g, '');
            let parts = val.split(',');
            if (parts.length > 2) parts = [parts[0], parts.slice(1).join('')];
            let intPart = parts[0];
            let decPart = parts.length > 1 ? parts[1].slice(0, 3) : null;
            if (intPart !== '') intPart = new Intl.NumberFormat('es-CL').format(parseInt(intPart, 10));
            e.target.value = decPart !== null ? `${intPart},${decPart}` : intPart;
        });
    });

    if (!simBtnSave) return;
    
    // --- LÓGICA DE ACTUALIZACIÓN --- //
    simBtnSave.addEventListener('click', () => {
        const values = {
            usd: { c: document.getElementById('sim-usd-compra').value, v: document.getElementById('sim-usd-venta').value },
            eur: { c: document.getElementById('sim-eur-compra').value, v: document.getElementById('sim-eur-venta').value },
            ars: { c: document.getElementById('sim-ars-compra').value, v: document.getElementById('sim-ars-venta').value },
            brl: { c: document.getElementById('sim-brl-compra').value, v: document.getElementById('sim-brl-venta').value },
            pen: { c: document.getElementById('sim-pen-compra').value, v: document.getElementById('sim-pen-venta').value },
            cop: { c: document.getElementById('sim-cop-compra').value, v: document.getElementById('sim-cop-venta').value }
        };

        const tvElements = {
            usd: { c: document.getElementById('sim-tv-usd-compra'), v: document.getElementById('sim-tv-usd-venta'), row: document.getElementById('sim-row-usd') },
            eur: { c: document.getElementById('sim-tv-eur-compra'), v: document.getElementById('sim-tv-eur-venta'), row: document.getElementById('sim-row-eur') },
            ars: { c: document.getElementById('sim-tv-ars-compra'), v: document.getElementById('sim-tv-ars-venta'), row: document.getElementById('sim-row-ars') },
            brl: { c: document.getElementById('sim-tv-brl-compra'), v: document.getElementById('sim-tv-brl-venta'), row: document.getElementById('sim-row-brl') },
            pen: { c: document.getElementById('sim-tv-pen-compra'), v: document.getElementById('sim-tv-pen-venta'), row: document.getElementById('sim-row-pen') },
            cop: { c: document.getElementById('sim-tv-cop-compra'), v: document.getElementById('sim-tv-cop-venta'), row: document.getElementById('sim-row-cop') }
        };

        const formatTV = (val, isGiant) => isGiant ? val.replace(/\./g, `<span class="text-[0.8em] opacity-70 mx-[0.05em]">.</span>`) : val;

        let hasChanges = false;
        let flashes = {};

        for (const key in values) {
            flashes[key] = parseForSim(tvElements[key].c.textContent) !== parseForSim(values[key].c) || parseForSim(tvElements[key].v.textContent) !== parseForSim(values[key].v);
            if (flashes[key]) hasChanges = true;
        }

        if (!hasChanges) return; 

        simBtnSave.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> Actualizando...`;
        simBtnSave.disabled = true;

        // Latencia Simulada 0ms (Actualización UI)
        setTimeout(() => {
            for (const key in values) {
                const isGiant = key === 'usd' || key === 'eur';
                
                // Actualizar Pizarra Frontal (Destacadas)
                tvElements[key].c.innerHTML = formatTV(values[key].c, isGiant);
                tvElements[key].v.innerHTML = formatTV(values[key].v, isGiant);
                
                // Actualizar Pizarra Trasera (General)
                const cBack = document.getElementById(`sim-tv-${key}-compra-back`);
                const vBack = document.getElementById(`sim-tv-${key}-venta-back`);
                if (cBack) cBack.innerHTML = formatTV(values[key].c, false); // Atrás no son gigantes
                if (vBack) vBack.innerHTML = formatTV(values[key].v, false);
            }

            simAudioAlert.play().catch(e => console.warn("Auto-play prevenido."));
            
            const flashClass = 'bg-white/30'; 
            for (const key in flashes) {
                if (flashes[key]) {
                    // Flash Frontal
                    tvElements[key].row.classList.add(flashClass);
                    setTimeout(() => tvElements[key].row.classList.remove(flashClass), 1500);
                    
                    // Flash Trasero
                    const rowBack = document.getElementById(`sim-row-${key}-back`);
                    if (rowBack) {
                        rowBack.classList.add(flashClass);
                        setTimeout(() => rowBack.classList.remove(flashClass), 1500);
                    }
                }
            }

            simBtnSave.innerHTML = `<svg class="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg> Actualizado`;
            simBtnSave.classList.replace('bg-blue-600', 'bg-emerald-600');
            simBtnSave.classList.replace('hover:bg-blue-500', 'hover:bg-emerald-500');

            setTimeout(() => {
                simBtnSave.disabled = false;
                simBtnSave.innerHTML = `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> Actualizar Precios`;
                simBtnSave.classList.replace('bg-emerald-600', 'bg-blue-600');
                simBtnSave.classList.replace('hover:bg-emerald-500', 'hover:bg-blue-500');
            }, 1500);

        }, 400); 
    });
});