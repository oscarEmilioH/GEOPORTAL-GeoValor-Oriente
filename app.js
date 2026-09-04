/* ============================================================
   GEOVALOR ORIENTE
   ============================================================ */


/* ============================================================
   GEOPACKAGE
   ============================================================ */

const {
    GeoPackageAPI,
    setSqljsWasmLocateFile
} = window.GeoPackage;


/*
 * Ubicación del archivo WASM
 */

setSqljsWasmLocateFile(
    file =>
        "https://unpkg.com/@ngageoint/geopackage/dist/" + file
);


/* ============================================================
   VARIABLES
   ============================================================ */

let map = null;

let capaSuelo = null;

let geojsonSuelo = null;


/* ============================================================
   INICIALIZAR MAPA
   ============================================================ */

function inicializarMapa() {

    map = L.map("map").setView(
        [14.8, -89.54],
        10
    );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,

            attribution:
                "&copy; OpenStreetMap contributors"
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

    const estado =
        document.getElementById("estadoGpkg");


    try {

        estado.textContent =
            "⏳ Cargando GeoPackage...";


        /*
         * IMPORTANTE:
         * Esta ruta debe coincidir exactamente
         * con la ubicación en GitHub.
         */

        const ruta =
            "datos/Valores_del_Suelo.gpkg";


        console.log(
            "Buscando GeoPackage:",
            ruta
        );


        /* ----------------------------------------------------
           DESCARGAR ARCHIVO
           ---------------------------------------------------- */

        const respuesta =
            await fetch(ruta);


        if (!respuesta.ok) {

            throw new Error(
                "No se pudo encontrar el GeoPackage. HTTP " +
                respuesta.status
            );
        }


        const arrayBuffer =
            await respuesta.arrayBuffer();


        console.log(
            "GeoPackage descargado correctamente."
        );


        /* ----------------------------------------------------
           ABRIR GEOPACKAGE
           ---------------------------------------------------- */

        const geoPackage =
            await GeoPackageAPI.open(
                arrayBuffer
            );


        console.log(
            "GeoPackage abierto correctamente."
        );


        /* ----------------------------------------------------
           OBTENER TABLAS
           ---------------------------------------------------- */

        const tablas =
            geoPackage.getFeatureTables();


        console.log(
            "Tablas encontradas:",
            tablas
        );


        if (
            !tablas ||
            tablas.length === 0
        ) {

            throw new Error(
                "El GeoPackage no contiene capas vectoriales."
            );
        }


        /*
         * Buscar nuestra tabla
         */

        let nombreTabla =
            tablas.find(
                tabla =>
                    tabla === "Valores del Suelo"
            );


        /*
         * Si no aparece exactamente,
         * usar la primera tabla.
         */

        if (!nombreTabla) {

            nombreTabla =
                tablas[0];

            console.warn(
                "No se encontró la tabla 'Valores del Suelo'. " +
                "Se utilizará: " +
                nombreTabla
            );
        }


        console.log(
            "Tabla utilizada:",
            nombreTabla
        );


        /* ----------------------------------------------------
           DAO
           ---------------------------------------------------- */

        const featureDao =
            geoPackage.getFeatureDao(
                nombreTabla
            );


        /*
         * Información de las columnas
         */

        const info =
            geoPackage.getInfoForTable(
                featureDao
            );


        /* ----------------------------------------------------
           GEOJSON
           ---------------------------------------------------- */

        const features = [];


        /*
         * IMPORTANTE:
         *
         * queryForEach() devuelve un ITERADOR.
         *
         * NO se debe usar:
         *
         * queryForEach(row => {})
         *
         * sino:
         *
         * const iterator = queryForEach();
         * for (const row of iterator)
         */

        const iterator =
            featureDao.queryForEach();


        for (
            const row of iterator
        ) {

            try {

                const feature =
                    featureDao.getRow(row);


                if (
                    !feature ||
                    !feature.geometry
                ) {

                    continue;
                }


                const geometry =
                    feature.geometry.geometry;


                if (!geometry) {

                    continue;
                }


                /*
                 * Convertir geometría
                 * a GeoJSON
                 */

                const geoJson =
                    geometry.toGeoJSON();


                /*
                 * Propiedades
                 */

                geoJson.properties = {};


                /*
                 * Guardar nombre de tabla
                 */

                geoJson.properties[
                    "table_name"
                ] = nombreTabla;


                /*
                 * Copiar atributos
                 */

                for (
                    const key in feature.values
                ) {

                    if (
                        Object.prototype.hasOwnProperty.call(
                            feature.values,
                            key
                        )
                    ) {

                        /*
                         * No mostrar geometría
                         * como atributo.
                         */

                        if (
                            feature.geometryColumn &&
                            key ===
                            feature.geometryColumn.name
                        ) {

                            continue;
                        }


                        /*
                         * Obtener nombre amigable
                         */

                        let nombreCampo =
                            key;


                        if (
                            info &&
                            info.columnMap &&
                            info.columnMap[key]
                        ) {

                            nombreCampo =
                                info.columnMap[key]
                                    .displayName ||
                                key;
                        }


                        geoJson.properties[
                            nombreCampo
                        ] =
                            feature.values[key];


                        /*
                         * También guardamos
                         * el nombre original.
                         */

                        geoJson.properties[
                            key
                        ] =
                            feature.values[key];

                    }

                }


                /*
                 * Agregar Feature
                 */

                features.push(
                    geoJson
                );


            } catch (error) {

                console.warn(
                    "Error leyendo una entidad:",
                    error
                );

            }

        }


        /* ----------------------------------------------------
           CREAR FEATURE COLLECTION
           ---------------------------------------------------- */

        geojsonSuelo = {

            type: "FeatureCollection",

            features: features

        };


        console.log(
            "Elementos encontrados:",
            features.length
        );


        if (
            features.length === 0
        ) {

            throw new Error(
                "La tabla existe, pero no contiene entidades."
            );
        }


        /* ----------------------------------------------------
           MOSTRAR CAPA
           ---------------------------------------------------- */

        mostrarCapaSuelo();


        /* ----------------------------------------------------
           ESTADÍSTICAS
           ---------------------------------------------------- */

        actualizarEstadisticas(
            features
        );


        /* ----------------------------------------------------
           ESTADO
           ---------------------------------------------------- */

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
            "✕ Error al cargar GeoPackage";


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

    }

}


/* ============================================================
   MOSTRAR CAPA
   ============================================================ */

function mostrarCapaSuelo() {

    /*
     * Eliminar capa anterior
     */

    if (capaSuelo) {

        map.removeLayer(
            capaSuelo
        );

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
     * Agregar al mapa
     */

    capaSuelo.addTo(
        map
    );


    /*
     * Zoom automático
     */

    const bounds =
        capaSuelo.getBounds();


    if (
        bounds.isValid()
    ) {

        map.fitBounds(
            bounds,
            {
                padding: [
                    40,
                    40
                ]
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


    if (
        valor >= 500
    ) {

        color =
            "#f44336";

    } else if (
        valor >= 250
    ) {

        color =
            "#ff9800";

    }


    return L.circleMarker(
        latlng,
        {

            radius: 9,

            fillColor: color,

            color: "#ffffff",

            weight: 2,

            opacity: 1,

            fillOpacity: 0.85

        }
    );
}


/* ============================================================
   POPUP
   ============================================================ */

function configurarPopup(
    feature,
    layer
) {

    const p =
        feature.properties;


    const valor =
        obtenerValor(p);


    layer.bindPopup(`

        <div class="popup">

            <h3>
                Valor del suelo
            </h3>

            <b>Valor:</b>
            ${formatearMoneda(valor)}
            <br><br>

            <b>Servicios:</b>
            ${valorTexto(
                obtenerCampo(
                    p,
                    "Servicios disponibles"
                )
            )}
            <br>

            <b>Tamaño del lote:</b>
            ${valorTexto(
                obtenerCampo(
                    p,
                    "Tamaño del lote"
                )
            )}
            <br>

            <b>Ciudad:</b>
            ${valorTexto(
                obtenerCampo(
                    p,
                    "Ciudad"
                )
            )}
            <br>

            <b>País:</b>
            ${valorTexto(
                obtenerCampo(
                    p,
                    "País de origen"
                )
            )}

        </div>

    `);


    /*
     * Mostrar ficha completa
     * en panel derecho.
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
   OBTENER CAMPO
   ============================================================ */

function obtenerCampo(
    propiedades,
    nombre
) {

    /*
     * Primero busca el nombre exacto.
     */

    if (
        propiedades[nombre] !== undefined
    ) {

        return propiedades[nombre];

    }


    /*
     * Buscar ignorando mayúsculas/minúsculas.
     */

    const clave =
        Object.keys(
            propiedades
        ).find(
            key =>
                key.toLowerCase() ===
                nombre.toLowerCase()
        );


    if (clave) {

        return propiedades[clave];

    }


    return null;
}


/* ============================================================
   OBTENER VALOR DEL SUELO
   ============================================================ */

function obtenerValor(
    propiedades
) {

    const valor =
        obtenerCampo(
            propiedades,
            "Valor del suelo actual (Dólares)"
        );


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
   MOSTRAR INFORMACIÓN
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
                        obtenerCampo(
                            p,
                            "Servicios disponibles"
                        )
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    Tamaño del lote
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        obtenerCampo(
                            p,
                            "Tamaño del lote"
                        )
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    Ciudad
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        obtenerCampo(
                            p,
                            "Ciudad"
                        )
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    País de origen
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        obtenerCampo(
                            p,
                            "País de origen"
                        )
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    Fuente de información
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        obtenerCampo(
                            p,
                            "Fuente de información"
                        )
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    Latitud
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        obtenerCampo(
                            p,
                            "Latitud"
                        )
                    )}
                </span>

            </div>


            <div class="dato">

                <span class="dato-label">
                    Longitud
                </span>

                <span class="dato-valor">
                    ${valorTexto(
                        obtenerCampo(
                            p,
                            "Longitud"
                        )
                    )}
                </span>

            </div>

        </div>

    `;

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


    document.getElementById(
        "cantidadPuntos"
    ).textContent =
        features.length;


    if (
        valores.length === 0
    ) {

        return;

    }


    const minimo =
        Math.min(
            ...valores
        );


    const maximo =
        Math.max(
            ...valores
        );


    const promedio =
        valores.reduce(
            (
                suma,
                valor
            ) =>
                suma + valor,
            0
        ) /
        valores.length;


    document.getElementById(
        "valorMinimo"
    ).textContent =
        formatearMoneda(
            minimo
        );


    document.getElementById(
        "valorMaximo"
    ).textContent =
        formatearMoneda(
            maximo
        );


    document.getElementById(
        "valorPromedio"
    ).textContent =
        formatearMoneda(
            promedio
        );

}


/* ============================================================
   MONEDA
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
   TEXTO
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
   CHECKBOX DE CAPA
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    function() {

        const check =
            document.getElementById(
                "checkSuelo"
            );


        if (check) {

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

        }


        /*
         * Botón recargar
         */

        const boton =
            document.getElementById(
                "btnRecargar"
            );


        if (boton) {

            boton.addEventListener(
                "click",
                function() {

                    cargarGeoPackageAutomaticamente();

                }
            );

        }

    }
);


/* ============================================================
   INICIO
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    async function() {

        console.log(
            "GeoValor Oriente iniciado correctamente."
        );


        inicializarMapa();


        if (
            !window.GeoPackage
        ) {

            console.error(
                "GeoPackage JS no está disponible."
            );

            document.getElementById(
                "estadoGpkg"
            ).textContent =
                "✕ GeoPackage JS no está disponible.";

            return;

        }


        /*
         * CARGA AUTOMÁTICA
         */

        await cargarGeoPackageAutomaticamente();

    }
);