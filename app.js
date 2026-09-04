/* ============================================================
   GEOVALOR ORIENTE
   Sistema de información geográfica del valor del suelo
   ============================================================ */


/* ============================================================
   CONFIGURACIÓN GEOPACKAGE
   ============================================================ */

const {
    GeoPackageAPI,
    setSqljsWasmLocateFile
} = window.GeoPackage;


/*
 * Ubicación del archivo WASM utilizado por GeoPackage JS
 */
setSqljsWasmLocateFile(
    file => {
        return "https://unpkg.com/@ngageoint/geopackage/dist/" + file;
    }
);


/* ============================================================
   VARIABLES
   ============================================================ */

let map;

let capaSuelo = null;

let geojsonSuelo = null;


/* ============================================================
   INICIALIZAR MAPA
   ============================================================ */

function inicializarMapa() {

    map = L.map("map", {
        zoomControl: true
    }).setView(
        [14.8, -89.54],
        10
    );


    /* OpenStreetMap */

    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,

            attribution:
                '&copy; OpenStreetMap contributors'
        }
    ).addTo(map);


    console.log(
        "Mapa inicializado correctamente."
    );
}


/* ============================================================
   CARGAR GEOPACKAGE AUTOMÁTICAMENTE
   ============================================================ */

async function cargarGeoPackageAutomaticamente() {

    const estado = document.getElementById(
        "estadoGpkg"
    );

    try {

        estado.textContent =
            "⏳ Cargando Valores_del_Suelo.gpkg...";


        /*
         * Ruta del archivo.
         *
         * Es importante usar una ruta relativa.
         * Esto funciona tanto localmente mediante servidor
         * como en GitHub Pages.
         */

        const ruta =
            "datos/Valores_del_Suelo.gpkg";


        console.log(
            "Buscando GeoPackage:",
            ruta
        );


        /*
         * Descargar el archivo
         */

        const respuesta =
            await fetch(ruta);


        if (!respuesta.ok) {

            throw new Error(
                "No se pudo encontrar el archivo. HTTP " +
                respuesta.status
            );
        }


        /*
         * Convertir archivo a ArrayBuffer
         */

        const arrayBuffer =
            await respuesta.arrayBuffer();


        console.log(
            "GeoPackage descargado correctamente."
        );


        /*
         * Abrir GeoPackage
         */

        const geoPackage =
            await GeoPackageAPI.open(
                arrayBuffer
            );


        console.log(
            "GeoPackage abierto correctamente."
        );


        /*
         * Obtener las tablas
         */

        const tablas =
            geoPackage.getFeatureTables();


        console.log(
            "Tablas encontradas:",
            tablas
        );


        if (!tablas || tablas.length === 0) {

            throw new Error(
                "El GeoPackage no contiene capas vectoriales."
            );
        }


        /*
         * Buscar específicamente:
         * Valores del Suelo
         */

        let nombreTabla =
            tablas.find(
                tabla =>
                    tabla === "Valores del Suelo"
            );


        /*
         * Si no la encuentra,
         * usar la primera tabla.
         */

        if (!nombreTabla) {

            nombreTabla =
                tablas[0];

            console.warn(
                "No se encontró 'Valores del Suelo'. " +
                "Se utilizará:",
                nombreTabla
            );
        }


        console.log(
            "Cargando tabla:",
            nombreTabla
        );


        /*
         * Obtener DAO
         */

        const featureDao =
            geoPackage.getFeatureDao(
                nombreTabla
            );


        /*
         * Crear colección GeoJSON
         */

        const features = [];


        /*
         * Leer cada registro
         */

        featureDao.queryForEach(
            row => {

                try {

                    const feature =
                        featureDao.getRow(row);


                    if (
                        !feature ||
                        !feature.geometry ||
                        !feature.geometry.geometry
                    ) {

                        return;
                    }


                    /*
                     * Convertir geometría a GeoJSON
                     */

                    const geometry =
                        feature.geometry.geometry.toGeoJSON();


                    /*
                     * Copiar atributos
                     */

                    const propiedades = {};


                    Object.keys(
                        feature.values
                    ).forEach(
                        campo => {

                            propiedades[campo] =
                                feature.values[campo];

                        }
                    );


                    /*
                     * Crear Feature
                     */

                    features.push({

                        type: "Feature",

                        geometry: geometry,

                        properties: propiedades

                    });


                } catch (error) {

                    console.warn(
                        "Error leyendo registro:",
                        error
                    );

                }

            }
        );


        /*
         * Crear FeatureCollection
         */

        geojsonSuelo = {

            type: "FeatureCollection",

            features: features

        };


        console.log(
            "Elementos cargados:",
            features.length
        );


        /*
         * Mostrar capa
         */

        mostrarCapaSuelo();


        /*
         * Actualizar estadísticas
         */

        actualizarEstadisticas(
            features
        );


        /*
         * Mensaje de éxito
         */

        estado.textContent =
            "✓ GeoPackage cargado automáticamente";


        estado.style.color =
            "#2e7d32";


        document.getElementById(
            "estadoConexion"
        ).textContent =
            "● Datos cargados";


        document.getElementById(
            "estadoConexion"
        ).style.color =
            "#90ee90";


    } catch (error) {

        console.error(
            "Error cargando GeoPackage:",
            error
        );


        estado.textContent =
            "✕ No se pudo cargar el GeoPackage";


        estado.style.color =
            "#c62828";


        document.getElementById(
            "estadoConexion"
        ).textContent =
            "● Error";


        document.getElementById(
            "estadoConexion"
        ).style.color =
            "#ff8a80";


        console.error(
            "Detalles:",
            error.message
        );

    }

}


/* ============================================================
   MOSTRAR CAPA DEL SUELO
   ============================================================ */

function mostrarCapaSuelo() {

    /*
     * Si ya existe una capa,
     * eliminarla primero.
     */

    if (capaSuelo) {

        map.removeLayer(
            capaSuelo
        );

    }


    if (
        !geojsonSuelo ||
        !geojsonSuelo.features.length
    ) {

        return;
    }


    /*
     * Crear capa GeoJSON
     */

    capaSuelo =
        L.geoJSON(
            geojsonSuelo,
            {

                pointToLayer:
                    crearPunto,

                onEachFeature:
                    configurarPopup

            }
        );


    /*
     * Mostrar en mapa
     */

    capaSuelo.addTo(map);


    /*
     * Ajustar zoom a los puntos
     */

    const bounds =
        capaSuelo.getBounds();


    if (bounds.isValid()) {

        map.fitBounds(
            bounds,
            {
                padding: [40, 40]
            }
        );

    }

}


/* ============================================================
   CREAR PUNTO
   ============================================================ */

function crearPunto(
    feature,
    latlng
) {

    const valor =
        obtenerValor(
            feature.properties
        );


    let color =
        "#4caf50";


    /*
     * Clasificación visual
     */

    if (valor >= 500) {

        color =
            "#f44336";

    } else if (valor >= 250) {

        color =
            "#ff9800";

    }


    return L.circleMarker(
        latlng,
        {

            radius: 8,

            fillColor: color,

            color: "#ffffff",

            weight: 2,

            opacity: 1,

            fillOpacity: 0.85

        }
    );
}


/* ============================================================
   CONFIGURAR POPUP
   ============================================================ */

function configurarPopup(
    feature,
    layer
) {

    const p =
        feature.properties;


    const valor =
        obtenerValor(p);


    /*
     * Popup del mapa
     */

    const popup = `

        <div class="popup">

            <h3>
                Valor del suelo
            </h3>

            <b>Valor:</b>
            ${formatearMoneda(valor)}
            <br>

            <b>Servicios:</b>
            ${valorTexto(
                p["Servicios disponibles"]
            )}
            <br>

            <b>Tamaño del lote:</b>
            ${valorTexto(
                p["Tamaño del lote"]
            )}
            <br>

            <b>Ciudad:</b>
            ${valorTexto(
                p["Ciudad"]
            )}
            <br>

            <b>País:</b>
            ${valorTexto(
                p["País de origen"]
            )}

        </div>

    `;


    layer.bindPopup(
        popup
    );


    /*
     * Cuando se hace clic,
     * mostrar información completa
     * en el panel derecho.
     */

    layer.on(
        "click",
        function() {

            mostrarInformacionPunto(
                p
            );

        }
    );

}


/* ============================================================
   MOSTRAR INFORMACIÓN EN PANEL DERECHO
   ============================================================ */

function mostrarInformacionPunto(
    p
) {

    const contenedor =
        document.getElementById(
            "informacionPunto"
        );


    const valor =
        obtenerValor(p);


    contenedor.innerHTML = `

        <div class="ficha">

            <h3 class="ficha-titulo">
                Información del terreno
            </h3>


            <div class="dato">

                <span class="dato-label">
                    Valor del suelo
                </span>

                <span class="dato-valor">
                    ${formatearMoneda(valor)}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    Servicios disponibles
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        p["Servicios disponibles"]
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    Tamaño del lote
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        p["Tamaño del lote"]
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    Ciudad
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        p["Ciudad"]
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    País de origen
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        p["País de origen"]
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    Fuente de información
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        p["Fuente de información"]
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    Latitud
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        p["Latitud"]
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    Longitud
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        p["Longitud"]
                    )}
                </span>

            </div>

        </div>

    `;

}


/* ============================================================
   OBTENER VALOR
   ============================================================ */

function obtenerValor(
    propiedades
) {

    const valor =
        propiedades[
            "Valor del suelo actual (Dólares)"
        ];


    const numero =
        Number(valor);


    if (
        Number.isNaN(numero)
    ) {

        return 0;

    }


    return numero;
}


/* ============================================================
   FORMATEAR MONEDA
   ============================================================ */

function formatearMoneda(
    valor
) {

    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0
        }
    ).format(valor);

}


/* ============================================================
   TEXTO SEGURO
   ============================================================ */

function valorTexto(
    valor
) {

    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {

        return "No disponible";

    }

    return valor;

}


/* ============================================================
   ESTADÍSTICAS
   ============================================================ */

function actualizarEstadisticas(
    features
) {

    const valores =
        features
            .map(
                feature =>
                    obtenerValor(
                        feature.properties
                    )
            )
            .filter(
                valor =>
                    valor > 0
            );


    /*
     * Cantidad
     */

    document.getElementById(
        "cantidadPuntos"
    ).textContent =
        features.length;


    if (!valores.length) {

        return;
    }


    /*
     * Mínimo
     */

    const minimo =
        Math.min(
            ...valores
        );


    /*
     * Máximo
     */

    const maximo =
        Math.max(
            ...valores
        );


    /*
     * Promedio
     */

    const promedio =
        valores.reduce(
            (
                suma,
                valor
            ) =>
                suma + valor,
            0
        ) / valores.length;


    document.getElementById(
        "valorMinimo"
    ).textContent =
        formatearMoneda(minimo);


    document.getElementById(
        "valorMaximo"
    ).textContent =
        formatearMoneda(maximo);


    document.getElementById(
        "valorPromedio"
    ).textContent =
        formatearMoneda(promedio);

}


/* ============================================================
   CONTROL DE CAPA
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        const check =
            document.getElementById(
                "checkSuelo"
            );


        check.addEventListener(
            "change",
            function() {

                if (!capaSuelo) {

                    return;
                }


                if (this.checked) {

                    capaSuelo.addTo(
                        map
                    );

                } else {

                    map.removeLayer(
                        capaSuelo
                    );

                }

            }
        );


        /*
         * Botón recargar
         */

        document
            .getElementById(
                "btnRecargar"
            )
            .addEventListener(
                "click",
                function() {

                    cargarGeoPackageAutomaticamente();

                }
            );

    }
);


/* ============================================================
   INICIO DE LA APLICACIÓN
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        console.log(
            "GeoValor Oriente iniciado."
        );


        inicializarMapa();


        /*
         * Esperar un momento para asegurarnos
         * de que GeoPackage JS está disponible.
         */

        if (
            !window.GeoPackage
        ) {

            console.error(
                "GeoPackage JS no está disponible."
            );

            document.getElementById(
                "estadoGpkg"
            ).textContent =
                "✕ No se pudo cargar GeoPackage JS";

            return;
        }


        /*
         * Cargar automáticamente
         */

        await cargarGeoPackageAutomaticamente();

    }
);